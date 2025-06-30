import argparse
from ultralytics import YOLO
import os
import shutil

#D:/bao/env/conda/Library/bin/conda.bat activate numsheep && python -W ignore D:\drone-overgrazing-detection\yoloNumSheepNKY\run.py --img_path 图片路径


#先 pip install ultralytics
#运行方法：python run.py --model_path 模型路径 --img_path 图片路径 --output_dir 保存位置 --output_name 输出文件夹名 --exist_ok 覆盖已有文件
#图像路径可以是文件夹，也可以是单张图片
#最终的生成的结构为：
# ├── output_dir文件夹
# │   ├── output_name文件夹
# │   │   ├── 预测结果图像（图片有点大，可以加一个图片压缩）
# │   │   ├── labels文件夹
# │   │   │   ├── 预测结果txt，每行一个预测框，有多少行就是预测了多少个框

# 需要传参：
# base_path: 模型文件夹
# img_path：预测图片路径

def parse_args():
    parser = argparse.ArgumentParser(description='YOLO 推理脚本')
    parser.add_argument('--model_path', type=str, default='D:/drone-overgrazing-detection/yoloNumSheepNKY/618数据yolo11x1920px.pt',
                        help='模型路径')
    parser.add_argument('--img_path', type=str, default='E:/手动切',
                        help='图片路径')
    parser.add_argument('--output_dir', type=str, default='E:/手动切/结果',
                        help='保存位置')
    parser.add_argument('--output_name', type=str, default='',
                        help='结果文件夹的名称，在 output_dir 下创建该文件夹保存结果')
    parser.add_argument('--exist_ok', action='store_true', default=True,
                        help='是否覆盖已有文件或文件夹')
    parser.add_argument('--conf', type=float, default=0.35,
                        help='置信度阈值')
    parser.add_argument('--imgsz', type=int, default=1920,
                        help='图像大小')
    parser.add_argument('--task', type=str, default='obb',
                        help='任务类型')
    parser.add_argument('--save', action='store_true', default=True,
                        help='是否保存结果图像')
    parser.add_argument('--save_txt', action='store_true', default=True,
                        help='是否保存结果文本')
    parser.add_argument('--show_labels', action='store_true', default=False,
                        help='是否显示标签')
    parser.add_argument('--max_det', type=int, default=3000,
                        help='最大检测数量')
    parser.add_argument('--animal', type=str, default='sheep',
                        help='动物类型：sheep/cow/both')
    return parser.parse_args()

def main():
    args = parse_args()
    # 根据路径获取文件名（不带扩展名，兼容Windows和Linux）
    # args.output_name = os.path.splitext(os.path.basename(args.img_path))[0]
    args.output_name = "result"  
    
    model = YOLO(args.model_path, task=args.task)
    result = model.predict(
        args.img_path,
        conf=args.conf,
        imgsz=args.imgsz,
        name=args.output_name,
        exist_ok=args.exist_ok,
        project=args.output_dir,
        save=args.save,
        save_txt=args.save_txt,
        show_labels=args.show_labels,
        max_det=args.max_det,
        line_width=4
    )

    # 循环处理 labels 文件夹下所有 txt 文件
    labels_dir = os.path.join(args.output_dir, args.output_name, "labels")
    parent_dir = os.path.join(args.output_dir, args.output_name)
    if os.path.exists(labels_dir):
        for file in os.listdir(labels_dir):
            if file.endswith(".txt"):
                file_path = os.path.join(labels_dir, file)
                # 统计行数
                with open(file_path, 'r') as f:
                    lines = f.readlines()
                    num_lines = len(lines)
                # 写入到上一级目录下同名 txt 文件
                out_file = os.path.join(parent_dir, file)
                with open(out_file, 'w') as f:
                    f.write(str(num_lines))
        # 删除 labels 文件夹
        shutil.rmtree(labels_dir)

if __name__ == '__main__':
    main()
    # model_path=r'D:\drone-overgrazing-detection\yoloNumSheepNKY\618数据yolo11x1920px.pt'
    # img_path = r"F:\DCIM\DJI_202506261417_120" 
    # # img_path = r"D:\CYWRJGDFMJCXT\滑框切图"
    # conf=0.35
    # imgsz=1920
    # name='618数据训练后'
    # model = YOLO(model_path,task='obb') 
    # result= model.predict(img_path,conf=conf,imgsz=imgsz,name=name,save=True,save_txt=True,show_labels=False,max_det=1200,line_width=3)
    # print(result)
