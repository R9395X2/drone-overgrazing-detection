import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Optional, Any
import json
import logging

class DatabaseManager:
    """数据库管理类，负责SQLite数据库的连接和操作"""
    
    def __init__(self, db_path: str = "database/drone_detection.db"):
        """
        初始化数据库管理器
        
        Args:
            db_path: 数据库文件路径
        """
        self.db_path = db_path
        self.init_database()
        
    def init_database(self):
        """初始化数据库，创建表结构"""
        try:
            # 确保数据库目录存在
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            # 读取并执行初始化SQL脚本
            sql_file_path = os.path.join(os.path.dirname(__file__), 'init_database.sql')
            with open(sql_file_path, 'r', encoding='utf-8') as f:
                init_sql = f.read()
            
            with sqlite3.connect(self.db_path) as conn:
                conn.executescript(init_sql)
                conn.commit()
                
            logging.info(f"数据库初始化完成: {self.db_path}")
            
        except Exception as e:
            logging.error(f"数据库初始化失败: {e}")
            raise
    
    def get_connection(self) -> sqlite3.Connection:
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # 启用字典式行访问
        return conn
    
    def execute_query(self, query: str, params: tuple = ()) -> List[Dict]:
        """
        执行查询SQL
        
        Args:
            query: SQL查询语句
            params: 查询参数
            
        Returns:
            查询结果列表
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.execute(query, params)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logging.error(f"查询执行失败: {e}, SQL: {query}")
            raise
    
    def execute_update(self, query: str, params: tuple = ()) -> int:
        """
        执行更新SQL（INSERT, UPDATE, DELETE）
        
        Args:
            query: SQL语句
            params: 参数
            
        Returns:
            影响的行数
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.execute(query, params)
                conn.commit()
                return cursor.rowcount
        except Exception as e:
            logging.error(f"更新执行失败: {e}, SQL: {query}")
            raise
    
    def insert_and_get_id(self, query: str, params: tuple = ()) -> int:
        """
        执行插入并返回新记录的ID
        
        Args:
            query: INSERT SQL语句
            params: 参数
            
        Returns:
            新插入记录的ID
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.execute(query, params)
                conn.commit()
                return cursor.lastrowid
        except Exception as e:
            logging.error(f"插入执行失败: {e}, SQL: {query}")
            raise

    # === 农户管理 ===
    def add_farmer(self, name: str, phone: str = None, address: str = None, 
                   sheep_count: int = 0, big_sheep_count: int = 0, small_sheep_count: int = 0,
                   cattle_count: int = 0, big_cattle_count: int = 0, small_cattle_count: int = 0,
                   pasture_area: float = None, notes: str = None) -> int:
        """添加农户"""
        query = """
        INSERT INTO farmers (name, phone, address, sheep_count, big_sheep_count, small_sheep_count,
                             cattle_count, big_cattle_count, small_cattle_count, pasture_area, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        return self.insert_and_get_id(query, (name, phone, address, sheep_count, big_sheep_count, small_sheep_count,
                                              cattle_count, big_cattle_count, small_cattle_count, pasture_area, notes))
    
    def get_farmers(self) -> List[Dict]:
        """获取所有农户"""
        return self.execute_query("SELECT * FROM farmers ORDER BY created_at DESC")
    
    def get_farmer_by_id(self, farmer_id: int) -> Optional[Dict]:
        """根据ID获取农户信息"""
        result = self.execute_query("SELECT * FROM farmers WHERE id = ?", (farmer_id,))
        return result[0] if result else None
    
    def update_farmer(self, farmer_id: int, **kwargs) -> int:
        """更新农户信息"""
        fields = []
        values = []
        for key, value in kwargs.items():
            if key in ['name', 'phone', 'address', 'sheep_count', 'big_sheep_count', 'small_sheep_count',
                       'cattle_count', 'big_cattle_count', 'small_cattle_count', 'pasture_area', 'notes']:
                fields.append(f"{key} = ?")
                values.append(value)
        
        if not fields:
            return 0
        
        fields.append("updated_at = CURRENT_TIMESTAMP")
        query = f"UPDATE farmers SET {', '.join(fields)} WHERE id = ?"
        values.append(farmer_id)
        
        return self.execute_update(query, tuple(values))

    # === 检测任务管理 ===
    def add_detection_task(self, farmer_id: int, task_name: str, detection_date: str,
                          media_folder_path: str, **kwargs) -> int:
        """添加检测任务"""
        query = """
        INSERT INTO detection_tasks 
        (farmer_id, task_name, detection_date, media_folder_path, media_type, 
         total_files, weather_condition, drone_model, pilot_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            farmer_id, task_name, detection_date, media_folder_path,
            kwargs.get('media_type', 'mixed'),
            kwargs.get('total_files', 0),
            kwargs.get('weather_condition'),
            kwargs.get('drone_model'),
            kwargs.get('pilot_name'),
            kwargs.get('notes')
        )
        return self.insert_and_get_id(query, params)
    
    def get_detection_tasks(self, farmer_id: int = None) -> List[Dict]:
        """获取检测任务"""
        if farmer_id:
            query = """
            SELECT dt.*, f.name as farmer_name 
            FROM detection_tasks dt 
            JOIN farmers f ON dt.farmer_id = f.id 
            WHERE dt.farmer_id = ? 
            ORDER BY dt.detection_date DESC
            """
            return self.execute_query(query, (farmer_id,))
        else:
            query = """
            SELECT dt.*, f.name as farmer_name 
            FROM detection_tasks dt 
            JOIN farmers f ON dt.farmer_id = f.id 
            ORDER BY dt.detection_date DESC
            """
            return self.execute_query(query)
    
    def get_task_by_id(self, task_id: int) -> Optional[Dict]:
        """根据ID获取任务详情"""
        query = """
        SELECT dt.*, f.name as farmer_name, f.sheep_count, f.pasture_area
        FROM detection_tasks dt 
        JOIN farmers f ON dt.farmer_id = f.id 
        WHERE dt.id = ?
        """
        result = self.execute_query(query, (task_id,))
        return result[0] if result else None
    
    def update_task_status(self, task_id: int, status: str, processed_files: int = None) -> int:
        """更新任务状态"""
        if processed_files is not None:
            query = "UPDATE detection_tasks SET status = ?, processed_files = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            return self.execute_update(query, (status, processed_files, task_id))
        else:
            query = "UPDATE detection_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            return self.execute_update(query, (status, task_id))

    # === 检测结果管理 ===
    def add_detection_result(self, task_id: int, file_name: str, file_path: str) -> int:
        """添加检测结果记录"""
        query = """
        INSERT INTO detection_results (task_id, file_name, file_path)
        VALUES (?, ?, ?)
        """
        return self.insert_and_get_id(query, (task_id, file_name, file_path))
    
    def update_nky_result(self, result_id: int, count: int, confidence: float = None, 
                         processed_image_path: str = None, processing_time: float = None) -> int:
        """更新NKY算法结果"""
        query = """
        UPDATE detection_results 
        SET nky_count = ?, nky_confidence = ?, nky_processed_image_path = ?, 
            nky_processing_time = ?, nky_status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """
        return self.execute_update(query, (count, confidence, processed_image_path, processing_time, result_id))
    
    def update_bjut_result(self, result_id: int, count: int, confidence: float = None,
                          processed_image_path: str = None, processing_time: float = None) -> int:
        """更新BJUT算法结果"""
        query = """
        UPDATE detection_results 
        SET bjut_count = ?, bjut_confidence = ?, bjut_processed_image_path = ?, 
            bjut_processing_time = ?, bjut_status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """
        return self.execute_update(query, (count, confidence, processed_image_path, processing_time, result_id))
    
    def get_detection_results(self, task_id: int) -> List[Dict]:
        """获取任务的所有检测结果"""
        query = "SELECT * FROM detection_results WHERE task_id = ? ORDER BY created_at"
        return self.execute_query(query, (task_id,))
    
    def update_manual_verification(self, result_id: int, manual_count: int, notes: str = None) -> int:
        """更新人工验证结果"""
        query = """
        UPDATE detection_results 
        SET manual_verified = TRUE, manual_count = ?, verification_notes = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """
        return self.execute_update(query, (manual_count, notes, result_id))

    # === 任务汇总管理 ===
    def create_task_summary(self, task_id: int) -> int:
        """创建任务汇总"""
        # 计算汇总数据
        results = self.get_detection_results(task_id)
        
        total_nky = sum(r['nky_count'] or 0 for r in results)
        total_bjut = sum(r['bjut_count'] or 0 for r in results)
        
        nky_confidences = [r['nky_confidence'] for r in results if r['nky_confidence']]
        bjut_confidences = [r['bjut_confidence'] for r in results if r['bjut_confidence']]
        
        avg_nky_conf = sum(nky_confidences) / len(nky_confidences) if nky_confidences else None
        avg_bjut_conf = sum(bjut_confidences) / len(bjut_confidences) if bjut_confidences else None
        
        # 计算过度放牧风险
        task = self.get_task_by_id(task_id)
        risk = 'low'
        density = None
        
        if task and task['pasture_area']:
            density = max(total_nky, total_bjut) / (task['pasture_area'] / 10000)  # 转换为公顷
            if density > 20:
                risk = 'high'
            elif density > 10:
                risk = 'medium'
        
        query = """
        INSERT OR REPLACE INTO task_summary 
        (task_id, total_nky_count, total_bjut_count, avg_nky_confidence, avg_bjut_confidence,
         overgrazing_risk, density_per_hectare)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        
        return self.insert_and_get_id(query, (task_id, total_nky, total_bjut, avg_nky_conf, 
                                            avg_bjut_conf, risk, density))
    
    def get_task_summary(self, task_id: int) -> Optional[Dict]:
        """获取任务汇总"""
        result = self.execute_query("SELECT * FROM task_summary WHERE task_id = ?", (task_id,))
        return result[0] if result else None

    # === 系统配置管理 ===
    def get_config(self, key: str) -> Optional[str]:
        """获取配置值"""
        result = self.execute_query("SELECT config_value FROM system_config WHERE config_key = ?", (key,))
        return result[0]['config_value'] if result else None
    
    def set_config(self, key: str, value: str, config_type: str = 'string', description: str = None) -> int:
        """设置配置值"""
        query = """
        INSERT OR REPLACE INTO system_config (config_key, config_value, config_type, description, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        """
        return self.execute_update(query, (key, value, config_type, description))
    
    # === 日志管理 ===
    def add_log(self, level: str, module: str, action: str, message: str, task_id: int = None):
        """添加系统日志"""
        query = """
        INSERT INTO system_logs (log_level, module, action, message, task_id)
        VALUES (?, ?, ?, ?, ?)
        """
        self.execute_update(query, (level, module, action, message, task_id))
    
    def get_logs(self, level: str = None, limit: int = 100) -> List[Dict]:
        """获取系统日志"""
        if level:
            query = "SELECT * FROM system_logs WHERE log_level = ? ORDER BY created_at DESC LIMIT ?"
            return self.execute_query(query, (level, limit))
        else:
            query = "SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?"
            return self.execute_query(query, (limit,))
    
    def cleanup_old_logs(self, days: int = 30):
        """清理旧日志"""
        query = "DELETE FROM system_logs WHERE created_at < datetime('now', '-{} days')".format(days)
        return self.execute_update(query)


# 单例模式的数据库管理器实例
db_manager = DatabaseManager()
