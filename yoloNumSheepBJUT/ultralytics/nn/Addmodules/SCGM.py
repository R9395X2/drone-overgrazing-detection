import torch
import torch.nn as nn


class SimpleConcat(nn.Module):
    def __init__(self, in_channels1, in_channels2, out_channels):  # 直接接收三个参数
        super().__init__()
        # 通道对齐
        self.conv1 = nn.Conv2d(in_channels1, out_channels // 2, 1)
        self.conv2 = nn.Conv2d(in_channels2, out_channels // 2, 1)
        self.final_conv = nn.Conv2d(out_channels, out_channels, 1)  # 确保输出通道正确

    def forward(self, x):
        x1, x2 = x  # 输入来自两个层
        # 通道对齐
        x1 = self.conv1(x1)
        x2 = self.conv2(x2)

        # 空间对齐（将x1上采样到x2的尺寸）
        if x1.shape[-2:] != x2.shape[-2:]:
            x1 = nn.functional.interpolate(x1, size=x2.shape[2:], mode='nearest')

        # 拼接
        fused = torch.cat([x1, x2], dim=1)
        return self.final_conv(fused)