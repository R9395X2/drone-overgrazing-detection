# 数据库说明

本数据库用于无人机草地过度放牧检测系统的数据存储，涵盖农户信息、检测任务、检测结果、系统配置与日志等。本文档详细说明各数据表结构及字段含义，便于开发与维护。

---

## 1. 表结构说明

### 1.1 farmers（农户信息表）

| 字段名           | 类型              | 说明           |
|------------------|-------------------|----------------|
| id               | INTEGER           | 主键，自增ID   |
| name             | VARCHAR(100)      | 农户姓名       |
| phone            | VARCHAR(20)       | 联系电话       |
| id_card          | TEXT              | 身份证号       |
| province         | TEXT              | 省份           |
| city             | TEXT              | 城市           |
| county           | TEXT              | 县             |
| town             | TEXT              | 乡镇           |
| village          | TEXT              | 村             |
| detail_address   | TEXT              | 详细地址       |
| sheep_count      | INTEGER           | 羊只数量       |
| cattle_count     | INTEGER           | 牛只数量       |
| horse_count      | INTEGER           | 马数量         |
| pasture_area     | DECIMAL(10,2)     | 草场面积(亩)   |
| fodder_area      | DECIMAL(10,2)     | 饲草面积(亩)   |
| suitable_capacity| INTEGER           | 适宜载畜量     |
| current_capacity | INTEGER           | 当前载畜量     |
| overload         | INTEGER           | 超载量         |
| notes            | TEXT              | 备注           |
| created_at       | DATETIME          | 创建时间       |
| updated_at       | DATETIME          | 更新时间       |

---

### 1.2 detection_tasks（检测任务表）

| 字段名           | 类型              | 说明                   |
|------------------|-------------------|------------------------|
| id               | INTEGER           | 主键，自增ID           |
| farmer_id        | INTEGER           | 农户ID，关联farmers    |
| task_name        | VARCHAR(200)      | 任务名称               |
| detection_date   | DATE              | 检测日期               |
| media_folder_path| TEXT              | 媒体文件夹路径         |
| media_type       | VARCHAR(50)       | 媒体类型               |
| total_files      | INTEGER           | 总文件数               |
| processed_files  | INTEGER           | 已处理文件数           |
| pilot_name       | VARCHAR(100)      | 操作员姓名             |
| status           | VARCHAR(20)       | 状态                   |
| notes            | TEXT              | 备注                   |
| created_at       | DATETIME          | 创建时间               |
| updated_at       | DATETIME          | 更新时间               |
| sheep_count      | INTEGER           | 检测羊只数             |
| cattle_count     | INTEGER           | 检测牛只数             |

> 外键：`farmer_id` 关联 farmers(id)

---

### 1.3 count_results（检测结果表）

| 字段名             | 类型              | 说明                   |
|--------------------|-------------------|------------------------|
| id                 | INTEGER           | 主键，自增ID           |
| task_id            | INTEGER           | 检测任务ID             |
| file_name          | VARCHAR(255)      | 文件名                 |
| file_path          | TEXT              | 文件路径               |
| algorithm_name     | VARCHAR(50)       | 算法名称               |
| sheep_count        | INTEGER           | 检测羊只数             |
| cattle_count       | INTEGER           | 检测牛只数             |
| status             | VARCHAR(20)       | 处理状态               |
| manual_verified    | BOOLEAN           | 是否人工校验           |
| manual_sheep_count | INTEGER           | 人工校验羊只数         |
| manual_cattle_count| INTEGER           | 人工校验牛只数         |
| notes              | TEXT              | 备注                   |
| created_at         | DATETIME          | 创建时间               |
| updated_at         | DATETIME          | 更新时间               |

> 外键：`task_id` 关联 detection_tasks(id)

---

### 1.4 temp_count_results（临时检测结果表）

| 字段名             | 类型              | 说明                   |
|--------------------|-------------------|------------------------|
| id                 | INTEGER           | 主键，自增ID           |
| file_name          | VARCHAR(255)      | 文件名                 |
| file_path          | TEXT              | 文件路径               |
| algorithm_name     | VARCHAR(50)       | 算法名称               |
| sheep_count        | INTEGER           | 检测羊只数             |
| cattle_count       | INTEGER           | 检测牛只数             |
| status             | VARCHAR(20)       | 处理状态               |
| manual_verified    | BOOLEAN           | 是否人工校验           |
| manual_sheep_count | INTEGER           | 人工校验羊只数         |
| manual_cattle_count| INTEGER           | 人工校验牛只数         |
| notes              | TEXT              | 备注                   |
| created_at         | DATETIME          | 创建时间               |
| updated_at         | DATETIME          | 更新时间               |

---

### 1.5 system_config（系统配置表）

| 字段名      | 类型           | 说明           |
|-------------|----------------|----------------|
| id          | INTEGER        | 主键，自增ID   |
| config_key  | VARCHAR(100)   | 配置键         |
| config_value| TEXT           | 配置值         |
| config_type | VARCHAR(20)    | 配置类型       |
| description | TEXT           | 配置描述       |
| created_at  | DATETIME       | 创建时间       |
| updated_at  | DATETIME       | 更新时间       |

---

### 1.6 system_logs（系统日志表）

| 字段名      | 类型           | 说明           |
|-------------|----------------|----------------|
| id          | INTEGER        | 主键，自增ID   |
| log_level   | VARCHAR(10)    | 日志级别       |
| module      | VARCHAR(50)    | 模块名称       |
| action      | VARCHAR(100)   | 操作           |
| message     | TEXT           | 日志消息       |
| task_id     | INTEGER        | 相关任务ID     |
| created_at  | DATETIME       | 创建时间       |

> 外键：`task_id` 关联 detection_tasks(id)

---

## 2. 索引说明

- `system_config(config_key)`：加速配置项查找
- `system_logs(log_level)`：按日志级别查询
- `system_logs(created_at)`：按日志时间查询
- `count_results(algorithm_name)`：按算法名称查询检测结果
- `count_results(file_name)`：按文件名查询检测结果
- `count_results(task_id)`：按任务ID查询检测结果
- `temp_count_results(file_name)`：临时检测结果文件名唯一索引
- `detection_tasks(detection_date)`：按检测日期查询任务
- `detection_tasks(farmer_id)`：按农户ID查询任务
- `detection_tasks(status)`：按任务状态查询

---

## 3. 表关系简述

- 一个农户（farmers）可有多个检测任务（detection_tasks）
- 一个检测任务可有多条检测结果（count_results）
- 临时检测结果（temp_count_results）用于中间态数据存储
- 日志（system_logs）可关联检测任务

---

## 4. 初始化

如需初始化新数据库，可直接运行 `init_database.sql` 文件。
