先 pip install ultralytics
运行方法：python inference.py --model_path 模型路径 --img_path 图片路径 --save_dir 保存位置 --output_name 输出文件夹名 --exist_ok 覆盖已有文件
图像路径可以是文件夹，也可以是单张图片
最终的生成的结构为：
 ├── save_dir文件夹
 │   ├── output_name文件夹
 │   │   ├── 预测结果图像（图片有点大，可以加一个图片压缩）
 │   │   ├── labels文件夹
 │   │   │   ├── 预测结果txt，每行一个预测框，有多少行就是预测了多少个框

需要传参：
 base_path: 模型文件夹
 img_path：预测图片路径


 现在的测试用yolo11x-obb.pt是改进检测头后的