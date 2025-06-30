from ultralytics import YOLO
import cv2
import numpy as np
import os
from datetime import datetime
import argparse
import warnings

# 显示设置优化
SCREEN_SIZE = (1440, 900)
POINT_CONFIG = {
    'radius': 5,
    'color': (0, 0, 255),
    'thickness': -1
}

def parse_args():
    parser = argparse.ArgumentParser(description='YOLO 推理脚本')
    parser.add_argument('--base_path', type=str, default='D:/project/nongye/yoloNumSheep/',
                        help='模型路径')
    parser.add_argument('--img_path', type=str, default='D:/project/nongye/yoloNumSheep/1_50.JPG',
                        help='图片路径')
    return parser.parse_args()

def draw_centers(image, results):
    """增强型中心点绘制（支持批量处理）"""
    boxes = results.boxes.xyxy.cpu().numpy()
    for box in boxes:
        x1, y1, x2, y2 = map(int, box)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        cv2.circle(image, (cx, cy),
                   POINT_CONFIG['radius'],
                   POINT_CONFIG['color'],
                   POINT_CONFIG['thickness'])
    return image

def process_image(image_path, output_folder, model):
    """图像处理增强版"""
    image = cv2.imread(image_path)
    if image is None:
        print("图片加载失败")
        return

    # 执行检测（关键参数配置）
    results = model(image, conf=0.5, iou=0.5, max_det=2000)

    # 可视化处理
    annotated_image = results[0].plot(boxes=False, labels=False, conf=False)
    annotated_image = draw_centers(annotated_image, results[0])

    # 动态统计
    class_counts = {
        0: len(results[0].boxes.cls[results[0].boxes.cls == 0]),
    }

    # 添加统计信息
    cv2.putText(annotated_image, f"Sheeps: {class_counts[0]}", (30, 50),
                cv2.FONT_HERSHEY_COMPLEX, 1.2, (0, 200, 0), 3)

    # 增强保存功能
    save_dir = "results/" + output_folder
    os.makedirs(save_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    save_path = os.path.join(save_dir, f"{output_folder}.jpg")
    cv2.imwrite(save_path, annotated_image)
    print(f"结果已保存至: {save_path}")
    countFile = os.path.join(save_dir, f"result.txt")
    # 将行数写入文件
    with open(countFile, 'w') as f:
        f.write(str(class_counts[0]))


def main():
    # args = parse_args()
    
    # # 初始化模型（增加全局参数设置）
    # # model = YOLO(args.base_path + 'best.pt') # 权重文件路径
    # # model.overrides['max_det'] = 2000  # 全局最大检测数
    
    # output_folder = args.img_path.split("/")[-1].split(".")[0]
    output_folder = "output"  # 假设输出文件夹名为output
    print(f"处理图片: {output_folder}")

    # input_source = args.img_path
    # if input_source.lower().endswith(('.jpg', '.png', '.jpeg')):
    #     print("处理单张图片")
    #     # process_image(input_source, output_folder, model)
    # else:
    #     print("不支持的输入格式")
    return "处理完成"

if __name__ == "__main__":
    main()