-- 由当前数据库结构自动生成
-- 如需初始化新数据库，可直接运行本SQL

-- 农户信息表
CREATE TABLE IF NOT EXISTS farmers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,           -- 主键，自增ID
    name VARCHAR(100) NOT NULL,                     -- 农户姓名
    phone VARCHAR(20),                              -- 联系电话
    id_card TEXT,                                   -- 身份证号
    province TEXT,                                  -- 省份
    city TEXT,                                      -- 城市
    county TEXT,                                    -- 县
    town TEXT,                                      -- 乡镇
    village TEXT,                                   -- 村
    detail_address TEXT,                            -- 详细地址
    sheep_count INTEGER DEFAULT 0,                  -- 羊只数量
    cattle_count INTEGER DEFAULT 0,                 -- 牛只数量
    horse_count INTEGER DEFAULT 0,                  -- 马数量
    pasture_area DECIMAL(10,2),                     -- 草场面积(亩)
    fodder_area DECIMAL(10,2),                      -- 饲草面积(亩)
    suitable_capacity INTEGER DEFAULT 0,            -- 适宜载畜量
    current_capacity INTEGER DEFAULT 0,             -- 当前载畜量
    overload INTEGER DEFAULT 0,                     -- 超载量
    notes TEXT,                                     -- 备注
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 更新时间
);

-- 检测任务表
CREATE TABLE IF NOT EXISTS detection_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,           -- 主键，自增ID
    farmer_id INTEGER NOT NULL,                     -- 农户ID，关联farmers
    task_name VARCHAR(200),                         -- 任务名称
    detection_date DATE NOT NULL,                   -- 检测日期
    media_folder_path TEXT NOT NULL,                -- 媒体文件夹路径
    media_type VARCHAR(50) DEFAULT 'mixed',         -- 媒体类型
    total_files INTEGER DEFAULT 0,                  -- 总文件数
    processed_files INTEGER DEFAULT 0,              -- 已处理文件数
    pilot_name VARCHAR(100),                        -- 操作员姓名
    status VARCHAR(20) DEFAULT 'pending',           -- 状态
    notes TEXT,                                     -- 备注
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
    sheep_count INTEGER DEFAULT 0,                  -- 检测羊只数
    cattle_count INTEGER DEFAULT 0,                 -- 检测牛只数
    CONSTRAINT fkey0 FOREIGN KEY (farmer_id) REFERENCES farmers(id) -- 外键，关联farmers
);

-- 检测结果表
CREATE TABLE IF NOT EXISTS count_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,           -- 主键，自增ID
    task_id INTEGER NOT NULL,                       -- 检测任务ID
    file_name VARCHAR(255) NOT NULL,                -- 文件名
    file_path TEXT NOT NULL,                        -- 文件路径
    algorithm_name VARCHAR(50) NOT NULL,            -- 算法名称
    sheep_count INTEGER DEFAULT 0,                  -- 检测羊只数
    cattle_count INTEGER DEFAULT 0,                 -- 检测牛只数
    status VARCHAR(20) DEFAULT 'pending',           -- 处理状态
    manual_verified BOOLEAN DEFAULT FALSE,          -- 是否人工校验
    manual_sheep_count INTEGER,                     -- 人工校验羊只数
    manual_cattle_count INTEGER,                    -- 人工校验牛只数
    notes TEXT,                                     -- 备注
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
    CONSTRAINT fkey0 FOREIGN KEY (task_id) REFERENCES detection_tasks(id) -- 外键
);

-- 临时检测结果表
CREATE TABLE IF NOT EXISTS temp_count_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,           -- 主键，自增ID
    file_name VARCHAR(255) NOT NULL,                -- 文件名
    file_path TEXT NOT NULL,                        -- 文件路径
    algorithm_name VARCHAR(50) DEFAULT 'NKY',       -- 算法名称
    sheep_count INTEGER,                            -- 检测羊只数
    cattle_count INTEGER,                           -- 检测牛只数
    status VARCHAR(20) DEFAULT 'pending',           -- 处理状态
    manual_verified BOOLEAN DEFAULT 0,              -- 是否人工校验
    manual_cattle_count INTEGER,                    -- 人工校验牛只数
    manual_sheep_count INTEGER,                     -- 人工校验羊只数
    notes TEXT,                                     -- 备注
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 更新时间
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,           -- 主键，自增ID
    config_key VARCHAR(100) NOT NULL UNIQUE,        -- 配置键
    config_value TEXT,                              -- 配置值
    config_type VARCHAR(20) DEFAULT 'string',       -- 配置类型
    description TEXT,                               -- 配置描述
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 更新时间
);

-- 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,           -- 主键，自增ID
    log_level VARCHAR(10) NOT NULL,                 -- 日志级别
    module VARCHAR(50),                             -- 模块名称
    action VARCHAR(100),                            -- 操作
    message TEXT NOT NULL,                          -- 日志消息
    task_id INTEGER,                                -- 相关任务ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    FOREIGN KEY (task_id) REFERENCES detection_tasks(id) -- 外键
);

-- 索引
-- 配置键索引，加速配置项查找
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
-- 日志级别索引
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(log_level);
-- 日志时间索引
CREATE INDEX IF NOT EXISTS idx_system_logs_date ON system_logs(created_at);
-- 算法名称索引
CREATE INDEX IF NOT EXISTS idx_detection_results_algorithm ON count_results(algorithm_name ASC);
-- 文件名索引
CREATE INDEX IF NOT EXISTS idx_detection_results_file_name ON count_results(file_name ASC);
-- 检测任务ID索引
CREATE INDEX IF NOT EXISTS idx_detection_results_task_id ON count_results(task_id ASC);
-- 临时检测结果文件名唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_temp_count_results_file_name ON temp_count_results(file_name);
-- 检测日期索引
CREATE INDEX IF NOT EXISTS idx_detection_tasks_date ON detection_tasks(detection_date ASC);
-- 农户ID索引
CREATE INDEX IF NOT EXISTS idx_detection_tasks_farmer_id ON detection_tasks(farmer_id ASC);
-- 检测任务状态索引
CREATE INDEX IF NOT EXISTS idx_detection_tasks_status ON detection_tasks(status ASC);
