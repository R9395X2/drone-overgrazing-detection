import argparse
import cv2
import numpy as np
import os

def parse_args():
    parser = argparse.ArgumentParser(description='根据标注文件生成结果图片')
    parser.add_argument('--media_root', type=str, required=False, default='', help='媒体库根目录')
    parser.add_argument('--image_relpath', type=str, required=False, help='原始图片相对路径')
    parser.add_argument('--label_relpath', type=str, required=False, help='标注文件相对路径')
    parser.add_argument('--output_relpath', type=str, required=False, help='输出图片相对路径')
    parser.add_argument('--image_path', type=str, required=False, help='原始图片绝对路径（兼容旧参数）')
    parser.add_argument('--label_path', type=str, required=False, help='标注文件绝对路径（兼容旧参数）')
    parser.add_argument('--output_path', type=str, required=False, help='输出图片绝对路径（兼容旧参数）')
    return parser.parse_args()

def draw_oriented_bbox(img, points, class_id, confidence=1.0):
    """绘制旋转边界框"""
    # 定义类别颜色和名称
    class_colors = {
        0: (255, 80, 0),    # 大羊 - 蓝色
        1: (255, 255, 0),  # 小羊 - 青色  
        2: (0, 0, 255),    # 大牛 - 红色
        3: (0, 165, 255)   # 小牛 - 橙色
    }
    
    class_names = {
        0: 'Large Sheep',
        1: 'Small Sheep', 
        2: 'Large Cattle',
        3: 'Small Cattle'
    }
    
    color = class_colors.get(class_id, (0, 255, 0))
    class_name = class_names.get(class_id, 'Unknown')
    
    # 将归一化坐标转换为像素坐标
    h, w = img.shape[:2]
    pixel_points = []
    for i in range(0, len(points), 2):
        x = int(points[i] * w)
        y = int(points[i + 1] * h)
        pixel_points.append([x, y])
    
    pixel_points = np.array(pixel_points, dtype=np.int32)
    
    # 绘制多边形边框
    cv2.polylines(img, [pixel_points], True, color, 4)
    # 半透明填充
    overlay = img.copy()
    cv2.fillPoly(overlay, [pixel_points], color)
    cv2.addWeighted(overlay, 0.3, img, 0.7, 0, img)
    
    # 不绘制任何文字标签

def generate_result_image(image_path, label_path, output_path):
    """生成带标注的结果图片"""
    # 读取图片
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"无法读取图片: {image_path}")
    
    # 读取标注文件
    if not os.path.exists(label_path):
        print(f"标注文件不存在: {label_path}")
        # 如果没有标注，直接复制原图
        cv2.imwrite(output_path, img)
        return
    
    with open(label_path, 'r') as f:
        lines = f.readlines()
    
    # 解析每一行标注
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        parts = line.split()
        if len(parts) < 9:  # 至少需要class_id + 8个坐标点
            continue
            
        try:
            class_id = int(parts[0])
            # 获取8个坐标点（4个点，每个点2个坐标）
            coords = [float(x) for x in parts[1:9]]
            confidence = float(parts[9]) if len(parts) > 9 else 1.0
            
            # 绘制边界框
            draw_oriented_bbox(img, coords, class_id, confidence)
            
        except (ValueError, IndexError) as e:
            print(f"解析标注行失败: {line}, 错误: {e}")
            continue
    
    # 确保输出目录存在
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    # 保存结果图片
    success = cv2.imwrite(output_path, img)
    if success:
        print(f"结果图片已保存到: {output_path}")
    else:
        raise RuntimeError(f"保存图片失败: {output_path}")

def main():
    args = parse_args()
    # 优先使用media_root+relpath参数，否则兼容旧参数
    if args.media_root and args.image_relpath and args.label_relpath and args.output_relpath:
        image_path = os.path.join(args.media_root, args.image_relpath)
        label_path = os.path.join(args.media_root, args.label_relpath)
        output_path = os.path.join(args.media_root, args.output_relpath)
    else:
        image_path = args.image_path
        label_path = args.label_path
        output_path = args.output_path
    try:
        generate_result_image(image_path, label_path, output_path)
        print("结果图片生成成功")
    except Exception as e:
        print(f"生成结果图片失败: {e}")
        return 1
    return 0

if __name__ == '__main__':
    exit(main())
