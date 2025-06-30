import argparse
from ultralytics import YOLO
from sahi.predict import get_sliced_prediction
from sahi import AutoDetectionModel
import os

#D:/bao/env/conda/Library/bin/conda.bat activate numsheep && python -W ignore D:\drone-overgrazing-detection\yoloNumSheepNKY\滑框切图.py --img_path 图片路径 --output_dir 输出路径




def main(model_path, h, w, image_path, output_dir):
    model2 = AutoDetectionModel.from_pretrained(
        model_type='ultralytics',
        model_path=model_path,
        confidence_threshold=0.35,
        device='cuda:0'
    )

    image_extensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG', '.tif']
    
    # 判断 image_path 是文件还是文件夹
    if os.path.isfile(image_path):
        image_files = [os.path.basename(image_path)]
        image_dir = os.path.dirname(image_path)
    elif os.path.isdir(image_path):
        image_dir = image_path
        image_files = [f for f in os.listdir(image_dir) if os.path.splitext(f)[1] in image_extensions]
    else:
        print(f"路径不存在: {image_path}")
        return

    for image_name in image_files:
        print(f"正在处理: {image_name}")
        result = get_sliced_prediction(
            detection_model=model2,
            image=os.path.join(image_dir, image_name),
            slice_height=h,
            slice_width=w,
            overlap_height_ratio=0.2,
            overlap_width_ratio=0.2
        )
        result_image_name = os.path.splitext(image_name)[0]
        result.export_visuals(
            export_dir=output_dir,
            hide_labels=True,
            rect_th=3,
            # text_size=0.6,
            file_name=result_image_name
        )
        count = len(result.object_prediction_list)
        with open(os.path.join(output_dir, f'{result_image_name}.txt'), 'w', encoding='utf-8') as count_file:
            count_file.write(str(count))

        # 把导出的文件名.png改为.jpg
        png_path = os.path.join(output_dir, f"{result_image_name}.png")
        jpg_path = os.path.join(output_dir, f"{result_image_name}.jpg")
        if os.path.exists(png_path):
            from PIL import Image
            img = Image.open(png_path)
            img = img.convert("RGB")
            img.save(jpg_path, "JPEG")
            os.remove(png_path)

        print(f"完成: {result_image_name}")

    print(f"所有图片处理完成，结果保存在: {output_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="滑框切图命令行工具")
    parser.add_argument('--model_path', type=str, help='模型路径', default='D:/drone-overgrazing-detection/yoloNumSheepNKY/618数据yolo11x1920px.pt')
    parser.add_argument('--h', type=int,help='切图高度', default=1280)
    parser.add_argument('--w', type=int, help='切图宽度', default=1280)
    parser.add_argument('--image_path', type=str, required=True, help='图片文件夹路径')
    parser.add_argument('--output_dir', type=str, required=True, help='输出结果文件夹路径')
    parser.add_argument('--animal', type=str, help='动物类型', default='sheep')
    args = parser.parse_args()
    args.output_dir = os.path.join(args.output_dir, 'result')
    main(args.model_path, args.h, args.w, args.image_path, args.output_dir)
