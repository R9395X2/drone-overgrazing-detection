import os
import sys
from PIL import Image

def tif2png(input_dir):
    for filename in os.listdir(input_dir):
        if filename.lower().endswith('.tif') or filename.lower().endswith('.tiff'):
            tif_path = os.path.join(input_dir, filename)
            png_path = os.path.splitext(tif_path)[0] + '.png'
            with Image.open(tif_path) as img:
                img.save(png_path)
            print(f"已转换: {tif_path} -> {png_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python TIF2PNG.py <tif图片所在文件夹路径>")
        sys.exit(1)
    input_dir = sys.argv[1]
    tif2png(input_dir)