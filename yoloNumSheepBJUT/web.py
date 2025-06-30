from flask import Flask, render_template, request, send_from_directory
from werkzeug.utils import secure_filename
import os
from ultralytics import YOLO
import cv2
import numpy as np
from datetime import datetime

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = r'D:\bao\code\yoloNumSheep\upload'

# 初始化YOLO模型
model = YOLO(r'./best.pt')
model.overrides['max_det'] = 2000  # 设置最大检测数

# 绘制中心点的配置
POINT_CONFIG = {
    'radius': 5,
    'color': (0, 0, 255),
    'thickness': -1
}


def draw_centers(image, results):
    """在检测到的物体中心绘制圆点"""
    boxes = results.boxes.xyxy.cpu().numpy()
    for box in boxes:
        x1, y1, x2, y2 = map(int, box)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        cv2.circle(image, (cx, cy), POINT_CONFIG['radius'],
                   POINT_CONFIG['color'], POINT_CONFIG['thickness'])
    return image


def process_image(image_path, upload_folder):
    """处理图片并返回结果文件名和数量"""
    image = cv2.imread(image_path)
    if image is None:
        return None, 0

    # 执行目标检测
    results = model(image, conf=0.5, iou=0.5)

    # 可视化结果
    annotated_image = results[0].plot(boxes=False, labels=False, conf=False)
    annotated_image = draw_centers(annotated_image, results[0])

    # 统计羊的数量
    count = len(results[0].boxes.cls)

    # 生成新的文件名并保存
    original_filename = os.path.basename(image_path)
    detected_filename = f"detected_{original_filename}"
    save_path = os.path.join(upload_folder, detected_filename)
    cv2.imwrite(save_path, annotated_image)

    return detected_filename, count


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/upload')
def upload_file():
    return render_template('upload.html')


@app.route('/uploader', methods=['POST'])
def uploader():
    if request.method == 'POST':
        f = request.files['file']
        filename = secure_filename(f.filename)
        f.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        return render_template('display.html',
                               original_filename=filename,
                               detected_filename=None,
                               count=None)


@app.route('/detect', methods=['POST'])
def detect():
    original_filename = request.form['filename']
    original_path = os.path.join(app.config['UPLOAD_FOLDER'], original_filename)
    detected_filename, count = process_image(original_path, app.config['UPLOAD_FOLDER'])
    return render_template('display.html',
                           original_filename=original_filename,
                           detected_filename=detected_filename,
                           count=count)

@app.route('/calc', methods=['GET'])
def calc():
    original_path = request.args.get('filename')
    detected_filename, count = process_image(original_path, app.config['UPLOAD_FOLDER'])
    return str(count)


if __name__ == '__main__':
    app.run(debug=True)