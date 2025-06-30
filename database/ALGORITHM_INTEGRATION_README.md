# 算法集成指南

本文档说明如何在无人机过度放牧检测系统中添加新的检测算法。

## 数据库架构概述

系统采用通用算法架构，支持多种检测算法的灵活扩展。主要涉及以下数据表：

- `detection_results` - 存储各算法的检测结果
- `task_summary` - 汇总任务的总体检测结果
- `system_config` - 系统配置，包括支持的算法列表

## 添加新算法的步骤

### 1. 更新系统配置

在 `system_config` 表中更新支持的算法列表：

```sql
-- 假设要添加 YOLOv8 算法
UPDATE system_config 
SET config_value = 'NKY,BJUT,YOLOv8' 
WHERE config_key = 'supported_algorithms';

-- 如果需要设置新算法为默认算法
UPDATE system_config 
SET config_value = 'YOLOv8' 
WHERE config_key = 'default_algorithm';
```

### 2. 插入检测结果

当新算法处理完图像后，将结果插入 `detection_results` 表：

```sql
INSERT INTO detection_results (
    task_id, 
    file_name, 
    file_path, 
    algorithm_name, 
    sheep_count, 
    cattle_count, 
    processing_status
) VALUES (
    1,                                      -- 任务ID
    'IMG_001.jpg',                         -- 文件名
    '/path/to/IMG_001.jpg',               -- 文件路径
    'YOLOv8',                             -- 算法名称
    25,                                   -- 检测到的羊数量
    3,                                    -- 检测到的牛数量
    'completed'                           -- 处理状态
);
```

### 3. 更新任务汇总

当算法处理完整个任务后，更新 `task_summary` 表：

```sql
-- 计算任务的总计数并更新汇总表
UPDATE task_summary 
SET 
    total_sheep_count = (
        SELECT SUM(sheep_count) 
        FROM detection_results 
        WHERE task_id = ? AND algorithm_name = 'YOLOv8'
    ),
    total_cattle_count = (
        SELECT SUM(cattle_count) 
        FROM detection_results 
        WHERE task_id = ? AND algorithm_name = 'YOLOv8'
    ),
    algorithms_used = CASE 
        WHEN algorithms_used IS NULL THEN 'YOLOv8'
        WHEN algorithms_used NOT LIKE '%YOLOv8%' THEN algorithms_used || ',YOLOv8'
        ELSE algorithms_used
    END
WHERE task_id = ?;
```

### 4. 更新检测任务状态

当算法处理完成后，更新 `detection_tasks` 表的盘点结果：

```sql
-- 根据算法结果更新检测任务的盘点数量
UPDATE detection_tasks 
SET 
    detected_sheep_count = (
        SELECT COALESCE(SUM(sheep_count), 0) 
        FROM detection_results 
        WHERE task_id = detection_tasks.id 
        AND algorithm_name = 'YOLOv8'
    ),
    detected_cattle_count = (
        SELECT COALESCE(SUM(cattle_count), 0) 
        FROM detection_results 
        WHERE task_id = detection_tasks.id 
        AND algorithm_name = 'YOLOv8'
    ),
    status = 'completed'
WHERE id = ?;
```

## 算法集成示例

以下是完整的 YOLOv8 算法集成示例：

```sql
-- 1. 添加算法到系统配置
UPDATE system_config 
SET config_value = 'NKY,BJUT,YOLOv8' 
WHERE config_key = 'supported_algorithms';

-- 2. 插入检测结果（假设任务ID为1）
INSERT INTO detection_results (task_id, file_name, file_path, algorithm_name, sheep_count, cattle_count, processing_status) VALUES
(1, 'IMG_001.jpg', '/images/IMG_001.jpg', 'YOLOv8', 28, 4, 'completed'),
(1, 'IMG_002.jpg', '/images/IMG_002.jpg', 'YOLOv8', 22, 2, 'completed'),
(1, 'IMG_003.jpg', '/images/IMG_003.jpg', 'YOLOv8', 35, 3, 'completed');

-- 3. 更新任务汇总
INSERT OR REPLACE INTO task_summary (
    task_id, 
    total_sheep_count, 
    total_cattle_count, 
    algorithms_used
) VALUES (
    1,
    85,  -- 28+22+35
    9,   -- 4+2+3
    'YOLOv8'
);

-- 4. 更新检测任务
UPDATE detection_tasks 
SET 
    detected_sheep_count = 85,
    detected_cattle_count = 9,
    status = 'completed'
WHERE id = 1;
```

## 多算法协同工作

系统支持多个算法同时处理同一任务，每个算法的结果独立存储：

```sql
-- 同一张图片可以有多个算法的检测结果
INSERT INTO detection_results (task_id, file_name, file_path, algorithm_name, sheep_count, cattle_count, processing_status) VALUES
(1, 'IMG_001.jpg', '/images/IMG_001.jpg', 'NKY', 25, 3, 'completed'),
(1, 'IMG_001.jpg', '/images/IMG_001.jpg', 'BJUT', 27, 4, 'completed'),
(1, 'IMG_001.jpg', '/images/IMG_001.jpg', 'YOLOv8', 26, 3, 'completed');

-- 汇总时可以选择最优结果或平均值
UPDATE task_summary 
SET algorithms_used = 'NKY,BJUT,YOLOv8'
WHERE task_id = 1;
```

## 查询和统计

### 按算法查询结果

```sql
-- 查询特定算法的检测结果
SELECT * FROM detection_results 
WHERE algorithm_name = 'YOLOv8' 
AND task_id = 1;

-- 统计各算法的准确性
SELECT 
    algorithm_name,
    COUNT(*) as total_detections,
    AVG(sheep_count) as avg_sheep_count,
    AVG(cattle_count) as avg_cattle_count
FROM detection_results 
WHERE processing_status = 'completed'
GROUP BY algorithm_name;
```

### 算法性能比较

```sql
-- 比较不同算法在同一任务上的表现
SELECT 
    dr.algorithm_name,
    SUM(dr.sheep_count) as total_sheep,
    SUM(dr.cattle_count) as total_cattle,
    COUNT(*) as processed_files
FROM detection_results dr
WHERE dr.task_id = 1
GROUP BY dr.algorithm_name;
```

## 注意事项

1. **算法名称规范**：使用简洁、易识别的算法名称，如 'NKY', 'BJUT', 'YOLOv8' 等
2. **数据一致性**：确保插入的检测结果与任务中的文件对应
3. **错误处理**：设置适当的 `processing_status` 来标识处理状态
4. **性能优化**：对于大量数据，考虑批量插入和索引优化
5. **触发器影响**：系统设置了自动更新 `farmers` 表的触发器，确保数据一致性

## 扩展功能

### 添加算法特定配置

```sql
-- 为新算法添加专用配置
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
('yolov8_confidence_threshold', '0.6', 'decimal', 'YOLOv8算法置信度阈值'),
('yolov8_max_detections', '1500', 'integer', 'YOLOv8算法最大检测数量'),
('yolov8_model_path', '/models/yolov8.pt', 'string', 'YOLOv8模型文件路径');
```

### 算法版本管理

```sql
-- 支持算法版本管理
ALTER TABLE detection_results ADD COLUMN algorithm_version VARCHAR(20);

-- 插入带版本信息的结果
INSERT INTO detection_results (..., algorithm_name, algorithm_version, ...) VALUES
(..., 'YOLOv8', 'v8.1.0', ...);
```

## 总结

通过以上步骤，您可以轻松地在系统中集成新的检测算法。系统的通用架构设计使得算法扩展变得简单而灵活，同时保持了数据的一致性和查询的高效性。
