#!/usr/bin/env python3
"""
Python脚本适配器
用于统一不同Python脚本的输入输出格式
支持两个YOLO羊群检测系统：
1. yoloNumSheepNKY - 通过统计labels文件夹中的txt文件行数来得出羊群数量
2. yoloNumSheepBJUT - 通过读取result.txt文件来得出羊群数量
"""

import sys
import json
import os
import subprocess
import traceback
from pathlib import Path
from PIL import Image

def compress_image(image_path, quality=80, max_size=(1920, 1080)):
    """压缩图片"""
    try:
        with Image.open(image_path) as img:
            # 如果图片尺寸超过最大尺寸，则调整大小
            if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # 压缩并保存
            if img.mode == 'RGBA':
                img = img.convert('RGB')
            
            compressed_path = str(Path(image_path).with_suffix('.compressed.jpg'))
            img.save(compressed_path, 'JPEG', quality=quality, optimize=True)
            return compressed_path
    except Exception as e:
        print(f"图片压缩失败: {e}", file=sys.stderr)
        return image_path

def run_yolo_nky(image_path, options=None):
    """运行yoloNumSheepNKY脚本"""
    try:
        # 优先使用本地路径
        local_script = Path(__file__).parent.parent / 'yoloNumSheepNKY' / 'run.py'
        if local_script.exists():
            script_path = str(local_script)
            # 设置工作目录为脚本所在目录
            work_dir = local_script.parent
        else:
            # 备用路径
            script_path = "D:/bao/code/yoloNumSheepNKY/run.py"
            work_dir = Path("D:/bao/code/yoloNumSheepNKY")
        
        if not Path(script_path).exists():
            return {
                "success": False,
                "error": f"yoloNumSheepNKY脚本不存在: {script_path}"
            }
        
        # 构建命令 - 使用传入的base_path参数
        cmd = [
            'python', '-W', 'ignore', script_path,
            '--base_path', str(work_dir) + '/',
            '--img_path', image_path
        ]
        
        print(f"执行命令: {' '.join(cmd)}", file=sys.stderr)
        print(f"工作目录: {work_dir}", file=sys.stderr)
        
        # 直接使用python执行，不依赖conda
        result = subprocess.run(
            cmd,
            cwd=str(work_dir),
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            # 解析结果
            image_name = Path(image_path).stem
            
            # 查找结果目录
            results_base = Path(__file__).parent.parent / 'yoloNumSheepNKY' / 'results'
            if not results_base.exists():
                results_base = Path("D:/bao/code/yoloNumSheepNKY/results")
            
            results_dir = results_base / image_name
            
            sheep_count = 0
            processed_image_path = None
            
            if results_dir.exists():
                # 通过统计labels文件夹中txt文件的行数来获取羊群数量
                labels_dir = results_dir / 'labels'
                if labels_dir.exists():
                    for txt_file in labels_dir.glob('*.txt'):
                        try:
                            with open(txt_file, 'r', encoding='utf-8') as f:
                                lines = f.readlines()
                                sheep_count += len([line for line in lines if line.strip()])
                        except Exception as e:
                            print(f"读取标签文件失败 {txt_file}: {e}", file=sys.stderr)
                
                # 查找处理后的图片并压缩
                for ext in ['.jpg', '.jpeg', '.png']:
                    img_file = results_dir / f'{image_name}{ext}'
                    if img_file.exists():
                        # 压缩图片
                        processed_image_path = compress_image(str(img_file))
                        break
            
            return {
                "success": True,
                "type": "yolo_nky",
                "results": {
                    "sheep_count": sheep_count,
                    "processed_image": processed_image_path,
                    "results_directory": str(results_dir) if results_dir.exists() else None
                },
                "raw_output": result.stdout,
                "raw_error": result.stderr
            }
        else:
            return {
                "success": False,
                "error": f"yoloNumSheepNKY脚本执行失败 (退出码: {result.returncode})",
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "yoloNumSheepNKY脚本执行超时"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"yoloNumSheepNKY执行异常: {str(e)}",
            "traceback": traceback.format_exc()
        }

def run_yolo_bjut(image_path, options=None):
    """运行yoloNumSheepBJUT脚本"""
    try:
        # 优先使用本地路径
        local_script = Path(__file__).parent.parent / 'yoloNumSheepBJUT' / 'count_final.py'
        if local_script.exists():
            script_path = str(local_script)
            # 设置工作目录为脚本所在目录
            work_dir = local_script.parent
        else:
            # 备用路径
            script_path = "D:/bao/code/yoloNumSheep/count_final.py"
            work_dir = Path("D:/bao/code/yoloNumSheep")
        
        if not Path(script_path).exists():
            return {
                "success": False,
                "error": f"yoloNumSheepBJUT脚本不存在: {script_path}"
            }
        
        # 构建命令 - 使用传入的base_path参数
        cmd = [
            'python', '-W', 'ignore', script_path,
            '--base_path', str(work_dir) + '/',
            '--img_path', image_path
        ]
        
        print(f"执行命令: {' '.join(cmd)}", file=sys.stderr)
        print(f"工作目录: {work_dir}", file=sys.stderr)
        
        # 直接使用python执行，不依赖conda
        result = subprocess.run(
            cmd,
            cwd=str(work_dir),
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            # 解析结果
            image_name = Path(image_path).stem
            
            # 查找结果目录
            results_base = Path(__file__).parent.parent / 'yoloNumSheepBJUT' / 'results'
            if not results_base.exists():
                results_base = Path("D:/bao/code/yoloNumSheep/results")
            
            results_dir = results_base / image_name
            
            sheep_count = 0
            processed_image_path = None
            
            if results_dir.exists():
                # 读取result.txt文件获取羊群数量
                result_file = results_dir / 'result.txt'
                if result_file.exists():
                    try:
                        with open(result_file, 'r', encoding='utf-8') as f:
                            content = f.read().strip()
                            sheep_count = int(content)
                    except Exception as e:
                        print(f"读取结果文件失败: {e}", file=sys.stderr)
                        sheep_count = 0
                
                # 查找处理后的图片并压缩
                for ext in ['.jpg', '.jpeg', '.png']:
                    img_file = results_dir / f'{image_name}{ext}'
                    if img_file.exists():
                        # 压缩图片
                        processed_image_path = compress_image(str(img_file))
                        break
            
            return {
                "success": True,
                "type": "yolo_bjut",
                "results": {
                    "sheep_count": sheep_count,
                    "processed_image": processed_image_path,
                    "results_directory": str(results_dir) if results_dir.exists() else None
                },
                "raw_output": result.stdout,
                "raw_error": result.stderr
            }
        else:
            return {
                "success": False,
                "error": f"yoloNumSheepBJUT脚本执行失败 (退出码: {result.returncode})",
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "yoloNumSheepBJUT脚本执行超时"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"yoloNumSheepBJUT执行异常: {str(e)}",
            "traceback": traceback.format_exc()
        }

def run_custom_script(image_path, script_path, options=None):
    """运行自定义Python脚本"""
    try:
        if not os.path.exists(script_path):
            return {
                "error": f"脚本文件不存在: {script_path}",
                "success": False
            }
        
        # 准备参数
        cmd = ['python', script_path, image_path]
        if options:
            cmd.append(json.dumps(options))
        
        print(f"执行命令: {' '.join(cmd)}", file=sys.stderr)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            # 尝试解析JSON输出
            try:
                output_data = json.loads(result.stdout)
                return {
                    "success": True,
                    "type": "custom_script",
                    "results": output_data
                }
            except json.JSONDecodeError:
                # 如果不是JSON，返回原始输出
                return {
                    "success": True,
                    "type": "text_output",
                    "content": result.stdout.strip(),
                    "raw": True
                }
        else:
            return {
                "success": False,
                "error": f"脚本执行失败 (退出码: {result.returncode})",
                "stdout": result.stdout,
                "stderr": result.stderr
            }
            
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "脚本执行超时"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"执行异常: {str(e)}",
            "traceback": traceback.format_exc()
        }

def main():
    """主函数"""
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "参数不足，需要: script_type image_path [options]"
        }))
        sys.exit(1)
    
    script_type = sys.argv[1]
    image_path = sys.argv[2]
    options = None
    
    if len(sys.argv) > 3:
        try:
            options = json.loads(sys.argv[3])
        except json.JSONDecodeError:
            options = {}
    
    # 验证图片文件存在
    if not os.path.exists(image_path):
        print(json.dumps({
            "success": False,
            "error": f"图片文件不存在: {image_path}"
        }))
        sys.exit(1)
    
    # 根据脚本类型执行相应的处理
    if script_type == "yolo_nky":
        result = run_yolo_nky(image_path, options)
    elif script_type == "yolo_bjut":
        result = run_yolo_bjut(image_path, options)
    elif script_type == "yolo":
        # 为了向后兼容，默认使用NKY版本
        result = run_yolo_nky(image_path, options)
    elif script_type == "custom":
        if not options or 'script_path' not in options:
            result = {
                "success": False,
                "error": "自定义脚本需要提供script_path选项"
            }
        else:
            result = run_custom_script(image_path, options['script_path'], options)
    else:
        result = {
            "success": False,
            "error": f"不支持的脚本类型: {script_type}。支持的类型: yolo_nky, yolo_bjut, yolo, custom"
        }
    
    # 输出JSON结果
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
