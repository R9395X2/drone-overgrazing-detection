import torch
import torch.nn as nn
from torchvision.ops import roi_align
import torch.nn.functional as F

class AutoBoxGraphAttention(nn.Module):
    def __init__(self, in_channels, num_heads=8, k_neighbors=5, roi_size=3):
        super().__init__()
        assert in_channels % num_heads == 0, f"通道数{in_channels}必须能被头数{num_heads}整除"

        self.in_channels = in_channels
        self.num_heads = num_heads
        self.k = k_neighbors
        self.roi_size = roi_size
        self.head_dim = in_channels // num_heads # 每个头的特征维度

        # 动态框生成器
        self.box_net = nn.Sequential(
            nn.Conv2d(in_channels, 64, 3, padding=1), # 提取框参数特征
            nn.GELU(),
            nn.Conv2d(64, 4, 1)  # 输出4个框参数：[x_c, y_c, w, h]
        )

        # 节点特征提取
        self.node_conv = nn.Conv2d(in_channels, in_channels, 1) # 1x1卷积保持通道数

        # 边权重生成
        self.edge_net = nn.Sequential(
            nn.Conv2d(4, 64, 3, padding=1), # 处理4个框参数
            nn.GroupNorm(8, 64), # 组归一化（8组）
            nn.GELU(),
            nn.Conv2d(64, num_heads, 1) # 输出num_heads个边权重
        )

        # 多头注意力机制
        self.qkv_conv = nn.Conv2d(in_channels, 3 * in_channels, 1) # 生成Q、K、V

        # 特征融合
        self.fusion = nn.Sequential(
            nn.Conv2d(2 * in_channels, in_channels, 3, padding=1), # 融合原始与聚合特征
            nn.BatchNorm2d(in_channels),
            nn.SiLU()
        )

    def forward(self, x):
        B, C, H, W = x.shape

        # 1. 动态框生成
        boxes = torch.sigmoid(self.box_net(x))  # [B,4,H,W] 生成归一化的框参数

        # 2. 生成ROI坐标
        rois = self._generate_rois(boxes, H, W) # 将归一化框参数转换为绝对坐标

        # 3. 节点特征提取
        node_feats = roi_align(
            self.node_conv(x),
            rois,
            (self.roi_size, self.roi_size),
            spatial_scale=1.0
        ).mean([2, 3]).view(B, H * W, C)  # [B,N,C]

        # 4. 边权重生成
        edge_weights = self.edge_net(boxes)  # [B,H,H,W]
        edge_weights = edge_weights.permute(0, 2, 3, 1).view(B, H * W, self.num_heads)  # [B,N,H]

        # 5. 注意力计算（修复维度问题）
        q, k, v = self.qkv_conv(x).chunk(3, 1) # 拆分Q、K、V
        q = q.view(B, self.num_heads, self.head_dim, H, W)  # [B,H,D,H,W]
        k = k.view(B, self.num_heads, self.head_dim, H, W)
        v = v.view(B, self.num_heads, self.head_dim, H, W)

        # 安全的多头注意力计算
        attn = torch.einsum('bhidw,bhidW->bhiwW', q, k) * (self.head_dim  ** -0.5)
        attn = attn + edge_weights.view(B, H, W, self.num_heads).permute(0, 3, 1, 2).unsqueeze(-1)
        attn = F.softmax(attn, dim=2)

        # 特征聚合
        aggregated = torch.einsum('bhiwW,bhidW->bhidw', attn, v).reshape(B, C, H, W)

        # 残差连接
        return self.fusion(torch.cat([x, aggregated], dim=1))

    def _generate_rois(self, boxes, feat_h, feat_w):
        """ 将归一化框坐标转换为ROI格式 """
        B, _, H, W = boxes.shape
        device = boxes.device

        # 转换为绝对坐标
        cx = boxes[:, 0] * feat_w # 中心x坐标（绝对值）
        cy = boxes[:, 1] * feat_h # 中心y坐标（绝对值）
        w = boxes[:, 2] * feat_w # 框宽度（绝对值）
        h = boxes[:, 3] * feat_h # 框高度（绝对值）

        x1 = (cx - w / 2).clamp(0, feat_w) # 左上角x（限制在特征图范围内）
        y1 = (cy - h / 2).clamp(0, feat_h) # 左上角y
        x2 = (cx + w / 2).clamp(0, feat_w) # 右下角x
        y2 = (cy + h / 2).clamp(0, feat_h) # 右下角y

        # 生成ROI张量
        batch_indices = torch.arange(B, device=device)[:, None, None].expand(-1, H, W)
        return torch.stack([
            batch_indices.reshape(-1).float(),
            x1.reshape(-1),
            y1.reshape(-1),
            x2.reshape(-1),
            y2.reshape(-1)
        ], dim=1)