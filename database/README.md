# 数据库说明

本目录包含项目所用 SQLite 数据库的初始化脚本和相关管理脚本。数据库用于存储农户信息、检测任务、检测结果、系统配置及日志等核心数据。

## 1. 初始化数据库

如需初始化新数据库，可直接运行 `init_database.sql` 脚本：

```bash
sqlite3 drone_detection.db < init_database.sql
```

或使用 Python 脚本 `database_manager.py` 进行管理。

## 2. 数据表结构

### 2.1 农户信息表 farmers

- 存储农户基本信息。
- 主要字段：`id`, `name`, `phone`, `id_card`, `province`, `city`, `county`, `town`, `detail_address`, `sheep_count`, `cattle_count`, `pasture_area`, `fodder_area`, `notes`, `created_at`, `updated_at`

### 2.2 检测任务表 detection_tasks

- 记录每次检测任务及其状态。
- 主要字段：`id`, `farmer_id`, `task_name`, `detection_date`, `media_folder_path`, `media_type`, `total_files`, `processed_files`, `pilot_name`, `status`, `notes`, `created_at`, `updated_at`, `sheep_count`, `cattle_count`
- 外键：`farmer_id` 关联 farmers

### 2.3 检测结果表 count_results

- 存储每个检测文件的识别结果。
- 主要字段：`id`, `task_id`, `file_name`, `file_path`, `algorithm_name`, `sheep_count`, `cattle_count`, `processing_status`, `manual_verified`, `manual_sheep_count`, `manual_cattle_count`, `notes`, `created_at`, `updated_at`
- 外键：`task_id` 关联 detection_tasks

### 2.4 临时检测结果表 temp_count_results

- 用于存放临时检测结果，便于人工校验和二次处理。
- 主要字段：`id`, `file_name`, `file_path`, `algorithm_name`, `sheep_count`, `cattle_count`, `status`, `manual_verified`, `manual_cattle_count`, `manual_sheep_count`, `notes`, `created_at`, `updated_at`

### 2.5 系统配置表 system_config

- 存储系统级配置项。
- 主要字段：`id`, `config_key`, `config_value`, `config_type`, `description`, `created_at`, `updated_at`

### 2.6 系统日志表 system_logs

- 记录系统运行日志。
- 主要字段：`id`, `log_level`, `module`, `action`, `message`, `task_id`, `created_at`
- 外键：`task_id` 关联 detection_tasks

## 3. 索引说明

- 针对常用查询字段建立了索引，如配置键、日志级别、检测任务日期、农户ID、检测状态等。
- 临时检测结果文件名唯一索引，保证文件唯一性。

## 4. 相关脚本

- `init_database.sql`：数据库结构初始化脚本。
- `database_manager.py`：数据库管理与操作脚本。

## 5. 维护建议

- 修改表结构请同步更新 `init_database.sql`。
- 重要数据操作建议通过事务处理，避免数据丢失。
- 定期备份 `drone_detection.db` 数据库文件。
