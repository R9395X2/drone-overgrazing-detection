import torch
import torch.nn as nn
import numpy as np


'''class OtsuAttention(nn.Module):
    def __init__(self, in_channels):
        super().__init__()
        self.channel_align = nn.Sequential(
            nn.Conv2d(in_channels, in_channels, 1),
            nn.BatchNorm2d(in_channels)
        )

        # 可学习参数
        self.alpha = nn.Parameter(torch.tensor(0.5))
        self.beta = nn.Parameter(torch.tensor(0.5))
        self.perturb_factor = nn.Parameter(torch.tensor(0.1))  # 自适应的扰动系数

    def _compute_otsu_mask(self, x):
        """加入扰动机制的OTSU计算"""
        # 动态直方图统计
        hist = torch.histc(x, bins=256, min=0, max=1) + 1e-6
        prob = hist / hist.sum()

        # 累积概率和均值计算
        cum_prob = torch.cumsum(prob, dim=0)
        cum_mean = torch.cumsum(prob * torch.arange(0, 256, device=x.device), dim=0)
        global_mean = cum_mean[-1]

        # 类间方差矩阵计算（核心修改部分）
        with torch.no_grad():
            # 原始方差计算
            variance = (global_mean * cum_prob - cum_mean)  ** 2 / (cum_prob * (1 - cum_prob) + 1e-8)

            # 添加可调节的线性扰动项（随阈值增大而增强）
            t_range = torch.linspace(0, 1, 256, device=x.device)
            variance += self.perturb_factor.abs() * t_range  # 强制扰动为正值

            # 带扰动的阈值选择
            threshold_idx = torch.argmax(variance)

        return (x > (threshold_idx.float() / 255.0)).float()

    def _differentiable_threshold(self, x_norm):
        """可微分的阈值近似计算"""
        # 动态生成位置权重
        pos_weight = torch.sigmoid(self.perturb_factor) * 2.0  # 约束在0-2之间
        t_positions = torch.linspace(0, 1, 256, device=x_norm.device)

        # 带权重的直方图统计
        weighted_hist = torch.histc(x_norm, bins=256, min=0, max=1) * (1 + pos_weight * t_positions)
        prob = weighted_hist / (weighted_hist.sum() + 1e-6)

        # 累积计算（保持可导性）
        cum_prob = torch.cumsum(prob, dim=0)
        cum_mean = torch.cumsum(prob * t_positions, dim=0)
        global_mean = cum_mean[-1]

        # 可导的方差近似
        variance = (global_mean * cum_prob - cum_mean) ** 2 / (cum_prob * (1 - cum_prob) + 1e-8)
        variance += torch.sigmoid(self.perturb_factor) * t_positions  # 可导的扰动项

        # 软阈值选择
        soft_mask = torch.softmax(variance * 10.0, dim=0)  # 用softmax近似argmax
        threshold = torch.sum(soft_mask * t_positions)

        return torch.sigmoid(100 * (x_norm - threshold))

    def forward(self, x):
        # 通道对齐与归一化
        x_align = self.channel_align(x)
        x_norm = (x_align - x_align.min()) / (x_align.max() - x_align.min() + 1e-6)

        # 动态生成注意力掩码
        if self.training:
            mask = self._differentiable_threshold(x_norm.mean(dim=1, keepdim=True))
        else:
            mask = self._compute_otsu_mask(x_norm.mean(dim=1, keepdim=True))

        # 权重增强机制
        alpha = torch.sigmoid(self.alpha) * 2.0  # 增强系数0-2
        beta = torch.sigmoid(self.beta)  # 保留系数0-1
        return x * (beta + alpha * mask)'''

import torch
import torch.nn as nn
import torch.nn.functional as F


class OtsuAttention(nn.Module):
    def __init__(self, in_channels):
        super().__init__()
        self.in_channels = in_channels
        self.reduction_ratio = 16  # 通道压缩比

        # 多尺度特征提取
        self.multi_scale = nn.Sequential(
            nn.Conv2d(in_channels, in_channels // 2, 3, padding=1, dilation=1), # 使用3x3卷积和dilation=1提取局部特征
            nn.ReLU(inplace=True),
            nn.Conv2d(in_channels // 2, in_channels, 3, padding=3, dilation=3), # 恢复通道数至输入维度，使用dilation=3扩大感受野，捕获多尺度上下文
            nn.BatchNorm2d(in_channels) # 批归一化特征
        )

        # 通道注意力模块
        self.channel_att = nn.Sequential(
            nn.AdaptiveAvgPool2d(1), # 压缩空间维度至1x1，获取通道级统计信息
            nn.Conv2d(in_channels, in_channels // self.reduction_ratio, 1),
            nn.ReLU(inplace=True),
            nn.Conv2d(in_channels // self.reduction_ratio, in_channels, 1),
            nn.Sigmoid()
        )

        # 空间注意力计算，输入为max_pool和avg_pool的拼接结果（2通道），用7x7卷积（类似CBAM）生成空间权重图
        self.spatial_conv = nn.Conv2d(2, 1, 7, padding=3)

        # 可学习参数
        self.alpha = nn.Parameter(torch.tensor(0.5))  # 通道权重系数
        self.beta = nn.Parameter(torch.tensor(0.5))  # 空间权重系数
        self.perturb = nn.Parameter(torch.tensor(0.1))  # 扰动强度系数

    def _dynamic_threshold(self, x):
        """带扰动机制的动态阈值计算"""
        # 特征标准化，标准化到[0,1]
        x_norm = (x - x.min()) / (x.max() - x.min() + 1e-6)

        # 直方图统计
        hist = torch.histc(x_norm, bins=256, min=0, max=1)
        prob = hist / (hist.sum() + 1e-6)

        # 累积计算
        cum_prob = torch.cumsum(prob, dim=0) # 累积概率
        t = torch.linspace(0, 1, 256, device=x.device) # 阈值候选区间
        cum_mean = torch.cumsum(prob * t, dim=0) # 累积均值
        global_mean = cum_mean[-1] # 全局均值

        # 带扰动的类间方差
        variance = (global_mean * cum_prob - cum_mean) ** 2 / (cum_prob * (1 - cum_prob) + 1e-8)
        variance += self.perturb.abs() * t  # 与阈值位置相关的扰动

        # 软选择阈值
        soft_mask = torch.softmax(variance * 10, dim=0)
        threshold = torch.sum(soft_mask * t) # 计算最终阈值
        return torch.sigmoid(50 * (x_norm - threshold))   # 生成二值化掩膜

    def forward(self, x):
        # 多尺度特征融合
        ms_feat = self.multi_scale(x)

        # 通道注意力
        channel_weights = self.channel_att(ms_feat) # 通道注意力权重
        channel_refined = ms_feat * channel_weights # 通道细化

        # 空间注意力
        max_pool, _ = torch.max(channel_refined, dim=1, keepdim=True)# 最大池化
        avg_pool = torch.mean(channel_refined, dim=1, keepdim=True) # 平均池化
        spatial_att = torch.sigmoid(self.spatial_conv(torch.cat([max_pool, avg_pool], dim=1))) # 空间注意力

        # 动态阈值分割
        threshold_mask = self._dynamic_threshold(spatial_att)

        # 权重融合
        alpha = torch.sigmoid(self.alpha) # 通道权重系数
        beta = torch.sigmoid(self.beta) # 空间权重系数
        enhanced = x * (1 + alpha * channel_weights + beta * threshold_mask) # 特征增强

        # 残差连接
        return 0.5 * enhanced + 0.5 * x # 残差连接

