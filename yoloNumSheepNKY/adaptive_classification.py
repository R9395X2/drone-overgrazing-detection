import numpy as np
import os
import cv2
from sklearn.mixture import GaussianMixture
import matplotlib.pyplot as plt
import logging
import json
from PIL import Image

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_image_size(image_path):
    """自动读取图片像素尺寸"""
    try:
        if not os.path.exists(image_path):
            logging.warning(f"Image file not found: {image_path}")
            return (1920, 1080)  # 默认尺寸
        
        # 使用OpenCV读取图片尺寸
        img = cv2.imdecode(np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            logging.warning(f"Failed to read image: {image_path}")
            return (1920, 1080)
        
        height, width = img.shape[:2]
        return (width, height)
    except Exception as e:
        logging.error(f"Error reading image size: {e}")
        return (1920, 1080)

def calculate_obb_area(points):
    """计算OBB旋转矩形面积（鞋带公式）"""
    x = points[0::2]
    y = points[1::2]
    return 0.5 * abs(sum(x[i]*y[i+1] - x[i+1]*y[i] for i in range(-1, 3)))

def adaptive_cattle_classification(annotations, image_path, config=None):
    """
    增强版自适应分类，自动获取图像尺寸
    :param annotations: YOLO-OBB格式标注列表
    :param image_path: 对应的图片路径
    :param config: 配置字典（可选），如{"small_thresh_ratio": 0.002, "gmm_components": 2}
    :return: (small_cattle_indices, large_cattle_indices, bbox_data)
    """
    if config is None:
        config = {}
    small_thresh_ratio = config.get("small_thresh_ratio", 0.002)
    gmm_components = config.get("gmm_components", 2)
    use_area_thresh = config.get("use_area_thresh", False)

    # 1. 自动获取图像尺寸
    img_size = get_image_size(image_path)
    logging.info(f"Image size: {img_size[0]}x{img_size[1]} pixels")
    
    # 2. 计算所有OBB框的面积和绝对大小
    areas = []
    absolute_sizes = []  # 以像素为单位的实际面积
    bbox_data = []
    
    for i, ann in enumerate(annotations):
        try:
            parts = ann.strip().split()
            if len(parts) < 9:
                continue
                
            points = list(map(float, parts[1:9]))
            area = calculate_obb_area(points)
            
            # 计算实际像素面积
            xs = [p * img_size[0] for p in points[0::2]]
            ys = [p * img_size[1] for p in points[1::2]]
            width = max(xs) - min(xs)
            height = max(ys) - min(ys)
            pixel_area = width * height
            
            # 计算中心点
            center_x = (min(xs) + max(xs)) / 2
            center_y = (min(ys) + max(ys)) / 2
            
            areas.append(area)
            absolute_sizes.append(pixel_area)
            bbox_data.append({
                "idx": i,
                "area": area,
                "pixel_area": pixel_area,
                "raw": ann,
                "center": (center_x, center_y),
                "points": points
            })
        except Exception as e:
            logging.warning(f"Error processing annotation {i}: {e}")
            continue
    
    if len(areas) < 3:
        # 牛太少时直接返回所有为大牛
        logging.info("Too few cattle (<3), classifying all as large cattle")
        return [], list(range(len(bbox_data))), bbox_data
    
    # 3. 绝对面积阈值：小牛最大不超过图像面积的0.2%
    image_area = img_size[0] * img_size[1]
    ABSOLUTE_SMALL_THRESH = image_area * small_thresh_ratio  # 动态阈值
    logging.info(f"Dynamic small cattle threshold: {ABSOLUTE_SMALL_THRESH:.0f} pixels (ratio={small_thresh_ratio})")
    
    if use_area_thresh:
        small_candidates = [i for i, data in enumerate(bbox_data) 
                          if data["pixel_area"] <= ABSOLUTE_SMALL_THRESH]
    else:
        small_candidates = list(range(len(bbox_data)))

    if use_area_thresh and not small_candidates:
        logging.info("No cattle below absolute size threshold, all classified as large")
        return [], list(range(len(bbox_data))), bbox_data
    
    # 4. 使用GMM聚类（仅对候选小牛）
    candidate_areas = [bbox_data[i]["area"] for i in small_candidates]
    
    # 对数变换处理长尾分布
    log_areas = np.log1p(candidate_areas).reshape(-1, 1)
    
    # 尝试聚类
    try:
        gmm = GaussianMixture(n_components=gmm_components, random_state=0)
        gmm.fit(log_areas)
        labels = gmm.predict(log_areas)

        # 确定小牛集群（面积均值更小的集群）
        means = gmm.means_.flatten()
        small_cluster = np.argmin(means)
        
        # 提取小牛索引
        small_indices_in_candidates = np.where(labels == small_cluster)[0]
        small_indices = [small_candidates[i] for i in small_indices_in_candidates]
        
        # 验证小牛集群
        if len(small_indices) > 0:
            small_areas = [candidate_areas[i] for i in small_indices_in_candidates]
            large_areas = [candidate_areas[i] for i in np.where(labels != small_cluster)[0]]
            
            # 验证条件1：小牛平均面积 < 大牛平均面积/3
            valid_ratio = np.mean(small_areas) < (np.mean(large_areas) / 3 if large_areas else 0)
            
            # 验证条件2：小牛最大面积 < 大牛最小面积
            valid_order = (max(small_areas) < min(large_areas)) if large_areas else True
            
            if valid_ratio and valid_order:
                logging.info(f"GMM clustering found {len(small_indices)} small cattle")
                large_indices = [i for i in range(len(bbox_data)) if i not in small_indices]
                return small_indices, large_indices, bbox_data
    except Exception as e:
        logging.warning(f"GMM clustering failed: {e}")
    
    # 5. 聚类失败或无效时使用稳健的百分位数法
    logging.info("Using robust percentile method")
    small_indices, large_indices = robust_percentile_classification(bbox_data, ABSOLUTE_SMALL_THRESH)
    return small_indices, large_indices, bbox_data

def robust_percentile_classification(bbox_data, abs_threshold):
    """稳健的百分位数分类法，处理无小牛情况"""
    # 只考虑绝对面积小于阈值的候选
    candidate_areas = [d["area"] for d in bbox_data if d["pixel_area"] <= abs_threshold]
    
    if not candidate_areas:
        return [], list(range(len(bbox_data)))
    
    # 计算面积分布的百分位数
    sorted_areas = np.sort(candidate_areas)
    p25 = np.percentile(sorted_areas, 25)
    p75 = np.percentile(sorted_areas, 75)
    iqr = p75 - p25
    
    # 动态阈值：下界以下为小牛
    lower_bound = max(0, p25 - 1.5 * iqr)
    
    # 收集小牛
    small_indices = []
    for data in bbox_data:
        if data["pixel_area"] <= abs_threshold and data["area"] <= lower_bound:
            small_indices.append(data["idx"])
    
    # 如果没有小牛满足条件，尝试更宽松的条件
    if not small_indices:
        min_area = min(candidate_areas)
        small_indices = [data["idx"] for data in bbox_data 
                        if data["pixel_area"] <= abs_threshold 
                        and data["area"] <= min_area * 1.5]
    
    large_indices = [i for i in range(len(bbox_data)) if i not in small_indices]
    return small_indices, large_indices

def visualize_classification(image_path, annotations, small_indices, bbox_data, img_size, output_dir=None):
    """可视化分类结果，并添加标签"""
    try:
        # 读取原始图片
        img = cv2.imdecode(np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            logging.warning(f"Failed to read image for visualization: {image_path}")
            return None
        
        # 创建结果图片的副本
        result_img = img.copy()
        
        # 设置绘制参数
        small_color = (0, 0, 255)  # 小牛 - 红色
        large_color = (0, 255, 0)  # 大牛 - 绿色
        text_color = (255, 255, 255)  # 白色文本
        bg_color = (0, 0, 0)  # 黑色背景
        
        # 计算文本大小比例
        text_scale = max(img_size[0], img_size[1]) / 1500  # 自适应文本大小
        text_thickness = max(1, int(text_scale * 1.5))
        
        # 绘制所有框并添加标签
        for i, data in enumerate(bbox_data):
            # 转换归一化坐标到像素坐标
            points = np.array(data["points"])
            points = points.reshape(4, 2)
            points[:, 0] *= img_size[0]
            points[:, 1] *= img_size[1]
            points = points.astype(int)
            
            # 确定颜色和标签
            if i in small_indices:
                color = small_color
                label = "Small"
            else:
                color = large_color
                label = "Large"
            
            # 绘制旋转矩形框
            cv2.polylines(result_img, [points], True, color, 2)
            
            # 获取中心点位置
            center_x, center_y = data["center"]
            center_x *= img_size[0]
            center_y *= img_size[1]
            center = (int(center_x), int(center_y))
            
            # 在中心点添加标签
            text_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, text_scale, text_thickness)[0]
            
            # 绘制文本背景
            bg_rect_start = (center[0] - text_size[0]//2 - 5, center[1] - text_size[1]//2 - 5)
            bg_rect_end = (center[0] + text_size[0]//2 + 5, center[1] + text_size[1]//2 + 5)
            cv2.rectangle(result_img, bg_rect_start, bg_rect_end, bg_color, -1)
            
            # 绘制文本
            text_pos = (center[0] - text_size[0]//2, center[1] + text_size[1]//2)
            cv2.putText(result_img, label, text_pos, 
                       cv2.FONT_HERSHEY_SIMPLEX, text_scale, text_color, text_thickness)
        
        # 添加统计信息
        stats_text = f"Small: {len(small_indices)}, Large: {len(bbox_data)-len(small_indices)}"
        stats_pos = (20, 40)
        stats_bg_size = cv2.getTextSize(stats_text, cv2.FONT_HERSHEY_SIMPLEX, text_scale*1.2, text_thickness+1)[0]
        cv2.rectangle(result_img, 
                      (stats_pos[0] - 10, stats_pos[1] - stats_bg_size[1] - 10),
                      (stats_pos[0] + stats_bg_size[0] + 10, stats_pos[1] + 10),
                      (0, 0, 0), -1)
        cv2.putText(result_img, stats_text, stats_pos,
                   cv2.FONT_HERSHEY_SIMPLEX, text_scale*1.2, (255, 255, 255), text_thickness+1)
        
        # 保存结果为jpg格式
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            base_name = os.path.splitext(os.path.basename(image_path))[0]
            output_path = os.path.join(output_dir, f"{base_name}_classification.jpg")
        else:
            base_name = os.path.splitext(os.path.basename(image_path))[0]
            output_path = f"./{base_name}_classification.jpg"
        print(f"Trying to save visualization to: {output_path}")
        # cv2.imwrite会根据扩展名自动保存为jpg格式
        save_success = cv2.imwrite(output_path, result_img)
        if save_success:
            logging.info(f"Visualization saved to: {output_path}")
        else:
            logging.error(f"cv2.imwrite failed to save visualization to: {output_path}")
            # 尝试用PIL保存
            try:
                img_pil = Image.fromarray(cv2.cvtColor(result_img, cv2.COLOR_BGR2RGB))
                img_pil.save(output_path, "JPEG")
                logging.info(f"Visualization saved to (via PIL): {output_path}")
                return output_path
            except Exception as e:
                logging.error(f"PIL save also failed: {e}")
                return None
        
        return output_path
    except Exception as e:
        logging.error(f"Visualization failed: {e}")
        return None

def process_single_image(image_path, annotation_path, output_dir=None, save_vis=False):
    """处理单张图片的完整流程"""
    try:
        with open(annotation_path, "r") as f:
            annotations = f.readlines()
    except Exception as e:
        logging.error(f"Failed to read annotations: {annotation_path}, error: {e}")
        annotations = []

    img_size = get_image_size(image_path)
    config = {
        "small_thresh_ratio": 0.002,
        "gmm_components": 2
    }
    small_indices, large_indices, bbox_data = adaptive_cattle_classification(annotations, image_path, config=config)
    small_cattle = [annotations[i] for i in small_indices]
    large_cattle = [annotations[i] for i in large_indices]

    # === 覆盖写回标签txt，首数字2为大牛，3为小牛 ===
    print(f"小牛数量: {len(small_cattle)}, 大牛数量: {len(large_cattle)}")
    new_lines = []
    for idx, line in enumerate(annotations):
        parts = line.strip().split()
        if len(parts) < 9:
            new_lines.append(line)
            continue
        if idx in small_indices:
            parts[0] = "3"
        elif idx in large_indices:
            parts[0] = "2"
        new_lines.append(" ".join(parts) + "\n")
    if new_lines:
        with open(annotation_path, "w") as f:
            f.writelines(new_lines)

    result = {
        "image_path": image_path,
        "image_size": img_size,
        "small_count": len(small_cattle),
        "large_count": len(large_cattle),
        "small_annotations": small_cattle,
        "large_annotations": large_cattle,
        "visualization_path": None
    }

    logging.info(f"Classification result: {len(small_cattle)} small, {len(large_cattle)} large")
    return result

def process_directory(image_dir, annotation_dir, output_dir=None, save_vis=False):
    """批量处理目录中的所有图片"""
    results = {} 

    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    image_files = [f for f in os.listdir(image_dir)
                  if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

    for img_file in image_files:
        base_name = os.path.splitext(img_file)[0]
        image_path = os.path.join(image_dir, img_file)
        annotation_path = os.path.join(annotation_dir, base_name + ".txt")

        if not os.path.exists(annotation_path):
            logging.warning(f"No annotation found for {img_file}")
            continue

        result = process_single_image(image_path, annotation_path, output_dir=None, save_vis=False)
        results[img_file] = result

    return results


if __name__ == "__main__":
    # 单张图片测试
    image_path = r"D:\drone-overgrazing-detection\adaptive_classification\DJI_20250623182305_0006_V.JPG"
    annotation_path = r"D:\drone-overgrazing-detection\adaptive_classification\DJI_20250623182305_0006_V.txt"
    output_dir = r"D:\drone-overgrazing-detection\adaptive_classification"  
    
    result = process_single_image(image_path, annotation_path, output_dir=output_dir)
    if result:
        print(f"小牛数量: {result['small_count']}")
        print(f"大牛数量: {result['large_count']}")
        print(f"可视化结果: {result['visualization_path']}")

    # 批量处理整个目录
    # results = process_directory("images/", "annotations/", "output/")


    # # 处理单张图片
    # result = process_single_image("farm_001.jpg", "farm_001.txt")

    # # 处理整个目录
    # results = process_directory("cattle_images/", "cattle_labels/")

    # # 导出结果
    # import json
    # with open("classification_results.json", "w") as f:
    #     json.dump(results, f, indent=2)
