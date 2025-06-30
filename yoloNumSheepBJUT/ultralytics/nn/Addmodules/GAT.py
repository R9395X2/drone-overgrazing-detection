# 能运行的GAT
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.ops import roi_align


class GraphEnhancedDetect(nn.Module):
    """YOLOv11图增强检测模块"""

    def __init__(self, ch_in, num_heads=8, k=9, virtual_ratio=0.5):
        super().__init__()
        self.ch_in = ch_in # 输入特征通道数
        self.k = k # 每个样本选取的节点数
        self.virtual_ratio = virtual_ratio # 虚拟框占比

        # 虚拟框生成参数
        self.register_buffer('step_counter', torch.tensor(0)) # 训练步数计数器
        self.virtual_decay = 0.95  # 虚拟框衰减率

        # 共享特征提取
        self.feature_extractor = nn.Sequential(
            nn.Conv2d(ch_in, ch_in, 3, padding=1), # 3x3卷积保持尺寸
            nn.BatchNorm2d(ch_in), # 批归一化
            nn.SiLU()  # 激活函数
        )

        # 图注意力网络
        self.gat = GATLayer(ch_in, num_heads) # 图注意力层

        # 特征重建层
        self.reconstructor = nn.Conv2d(ch_in, ch_in, 1) # 1x1卷积
        self.norm = nn.BatchNorm2d(ch_in) # 批归一化

    def forward(self, x, yolo_boxes=None):
        B, C, H, W = x.shape  # 输入张量维度

        # 阶段1：特征增强
        feat = self.feature_extractor(x) # 提取基础特征

        # 阶段2：节点生成
        boxes = self._get_boxes(x, yolo_boxes)  # 获取混合框

        # 阶段3：ROI特征提取
        node_features = self._roi_pool(feat, boxes)  # 提取节点特征 [B*k, C]

        # 阶段4：图特征聚合
        enhanced = self.gat(node_features) # 图注意力增强

        # 阶段5：特征重建
        out = self._reconstruct(enhanced, B, H, W) # 重建空间特征
        return x + self.norm(self.reconstructor(out)) # 残差连接

    def _get_boxes(self, x, yolo_boxes):
        """混合真实框与虚拟框"""
        B = x.size(0)
        current_ratio = self.virtual_ratio * (self.virtual_decay  ** self.step_counter)

        # 生成虚拟框
        virtual_boxes = torch.rand(B, self.k, 4, device=x.device)
        virtual_boxes[:, :, 2:] += virtual_boxes[:, :, :2]  # 转换xywh为xyxy

        # 混合真实框（如果存在）
        if yolo_boxes is not None and yolo_boxes.numel() > 0:
            num_real = int(self.k * (1 - current_ratio))
            real_boxes = self._sample_real_boxes(yolo_boxes, num_real)
            virtual_boxes[:, :num_real] = real_boxes

        self.step_counter += 1
        return virtual_boxes.clamp(0, 1)

    def _sample_real_boxes(self, boxes, num):
        """从YOLO输出中采样真实框"""
        B = boxes.size(0)
        sampled = []
        for b in range(B):
            valid = boxes[b, :, 4] > 0.1  # 置信度阈值
            if valid.sum() == 0:
                sampled.append(torch.zeros(num, 4, device=boxes.device))
            else:
                indices = torch.multinomial(valid.float(), num)
                sampled.append(boxes[b, indices, :4])
        return torch.stack(sampled)

    def _roi_pool(self, x, boxes):
        """自适应ROI池化"""
        B, k = boxes.shape[:2]
        spatial_scale = 1.0 / (2  ** (len(x.shape[2:]) - 2))  # 自动匹配下采样率

        # 转换到特征图坐标
        abs_boxes = boxes * torch.tensor(
            [x.size(3) - 1, x.size(2) - 1, x.size(3) - 1, x.size(2) - 1],
            device=x.device
        )

        # 构建ROI列表
        rois = torch.cat([
            torch.cat([
                torch.full((k, 1), b, device=x.device, dtype=torch.float),
                abs_boxes[b]
            ], dim=1)
            for b in range(B)
        ])

        return roi_align(
            x,
            rois,
            output_size=(1, 1), # 输出1x1特征
            spatial_scale=spatial_scale # 特征图缩放比例
        ).view(B * k, -1) # 展平为[B*k, C]

    def _reconstruct(self, features, B, H, W):
        """空间特征重建（修正版）"""
        features = features.view(B, self.k, self.ch_in) # 恢复批次维度

        # 生成空间权重(基于特征重要性)
        weights = F.softmax(features.mean(dim=-1), dim=1)  # [B, k]

        # 加权特征融合
        weighted_features = torch.einsum('bkc,bk->bc', features, weights)  # [B, C]

        # 空间广播重建
        return weighted_features.view(B, -1, 1, 1).expand(-1, -1, H, W)


class GATLayer(nn.Module):
    """优化后的图注意力层"""

    def __init__(self, feat_dim, num_heads=8):
        super().__init__()
        # 添加维度校验
        assert feat_dim % num_heads == 0, f"特征维度{feat_dim}必须能被头数{num_heads}整除"
        self.num_heads = num_heads
        self.head_dim = feat_dim // num_heads

        # 添加参数范围校验
        assert self.head_dim > 0, "head_dim必须大于0，请检查输入通道数与头数的比例"

        # 共享参数投影
        self.q_proj = nn.Linear(feat_dim, num_heads * self.head_dim) # 查询投影
        self.k_proj = nn.Linear(feat_dim, num_heads * self.head_dim) # 键投影
        self.v_proj = nn.Linear(feat_dim, num_heads * self.head_dim) # 值投影

        # 注意力缩放因子
        self.scale = nn.Parameter(torch.tensor(1.0 / (self.head_dim  ** 0.5)))

        # 输出融合
        self.out_fc = nn.Linear(num_heads * self.head_dim, feat_dim) # 输出投影
        self.norm = nn.LayerNorm(feat_dim) # 层归一化

    def forward(self, x):
        Bk, C = x.shape  # Bk = batch_size * k

        # 投影Q/K/V并分割多头
        q = self.q_proj(x).view(Bk, self.num_heads, self.head_dim)  # [Bk, H, D]
        k = self.k_proj(x).view(Bk, self.num_heads, self.head_dim)
        v = self.v_proj(x).view(Bk, self.num_heads, self.head_dim)

        # 注意力计算（优化后的爱因斯坦表示法）
        attn_scores = torch.einsum('ihd,jhd->ijh', q, k) * self.scale  # [Bk, Bk, H]
        attn = F.softmax(attn_scores, dim=1)

        # 信息聚合
        messages = torch.einsum('ijh,jhd->ihd', attn, v)  # [Bk, H, D]
        messages = messages.reshape(Bk, -1)  # [Bk, H*D]

        # 残差连接与归一化+
        return self.norm(x + self.out_fc(messages))