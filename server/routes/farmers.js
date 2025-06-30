const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const DB_PATH = path.join(__dirname, '../../database/drone_detection.db');

// 获取所有农户
router.get('/', async (req, res) => {
    try {
        const db = new sqlite3.Database(DB_PATH);
        
        const query = `
            SELECT 
                f.*,
                COUNT(dt.id) as total_detections,
                MAX(dt.detection_date) as last_detection_date,
                COALESCE(AVG(dt.sheep_count), f.sheep_count) as avg_sheep_count,
                COALESCE(AVG(dt.cattle_count), f.cattle_count) as avg_cattle_count
            FROM farmers f
            LEFT JOIN detection_tasks dt ON f.id = dt.farmer_id
            GROUP BY f.id
            ORDER BY f.name
        `;
        
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('查询农户数据失败:', err);
                res.status(500).json({ error: '查询农户数据失败' });
                return;
            }
            
            // 设置状态
            const farmers = rows.map(farmer => ({
                ...farmer,
                status: farmer.last_detection_date && 
                       new Date() - new Date(farmer.last_detection_date) < 30 * 24 * 60 * 60 * 1000 
                       ? 'active' : 'inactive'
            }));
            
            res.json({ farmers });
            db.close();
        });
        
    } catch (error) {
        console.error('获取农户列表失败:', error);
        res.status(500).json({ error: '获取农户列表失败' });
    }
});

// 获取单个农户详情
router.get('/:id', async (req, res) => {
    try {
        const farmerId = req.params.id;
        const db = new sqlite3.Database(DB_PATH);
        
        const query = `
            SELECT 
                f.*,
                COUNT(dt.id) as total_detections,
                MAX(dt.detection_date) as last_detection_date,
                COALESCE(AVG(dt.sheep_count), f.sheep_count) as avg_sheep_count,
                COALESCE(AVG(dt.cattle_count), f.cattle_count) as avg_cattle_count
            FROM farmers f
            LEFT JOIN detection_tasks dt ON f.id = dt.farmer_id
            WHERE f.id = ?
            GROUP BY f.id
        `;
        
        db.get(query, [farmerId], (err, row) => {
            if (err) {
                console.error('查询农户详情失败:', err);
                res.status(500).json({ error: '查询农户详情失败' });
                return;
            }
            
            if (!row) {
                res.status(404).json({ error: '农户不存在' });
                return;
            }
            
            res.json({ farmer: row });
            db.close();
        });
        
    } catch (error) {
        console.error('获取农户详情失败:', error);
        res.status(500).json({ error: '获取农户详情失败' });
    }
});

// 创建新农户
router.post('/', async (req, res) => {
    try {
        const {
            name, phone, id_card,
            province, city, county, town, village, detail_address,
            sheep_count, cattle_count, horse_count,
            pasture_area, fodder_area,
            suitable_capacity, current_capacity, overload,
            notes
        } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: '农户姓名不能为空' });
        }

        const db = new sqlite3.Database(DB_PATH);

        const query = `
            INSERT INTO farmers (
                name, phone, id_card, province, city, county, town, village, detail_address, sheep_count, cattle_count, horse_count, pasture_area, fodder_area, suitable_capacity, current_capacity, overload, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(query, [
            name.trim(),
            phone || null,
            id_card || null,
            province || null,
            city || null,
            county || null,
            town || null,
            village || null,
            detail_address || null,
            sheep_count || 0,
            cattle_count || 0,
            horse_count || 0,
            pasture_area || 0,
            fodder_area || 0,
            suitable_capacity || 0,
            current_capacity || 0,
            overload || 0,
            notes || null
        ], function(err) {
            if (err) {
                console.error('创建农户失败:', err);
                res.status(500).json({ error: '创建农户失败' });
                return;
            }

            res.status(201).json({
                message: '农户创建成功',
                farmerId: this.lastID
            });
            db.close();
        });

    } catch (error) {
        console.error('创建农户失败:', error);
        res.status(500).json({ error: '创建农户失败' });
    }
});

// 更新农户信息
router.put('/:id', async (req, res) => {
    try {
        const farmerId = req.params.id;
        const {
            name, phone, id_card,
            province, city, county, town, village, detail_address,
            sheep_count, cattle_count, horse_count,
            pasture_area, fodder_area,
            suitable_capacity, current_capacity, overload,
            notes
        } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: '农户姓名不能为空' });
        }

        const db = new sqlite3.Database(DB_PATH);

        const query = `
            UPDATE farmers
            SET name = ?, phone = ?, id_card = ?, province = ?, city = ?, county = ?, town = ?, village = ?, detail_address = ?,
                sheep_count = ?, cattle_count = ?, horse_count = ?, pasture_area = ?, fodder_area = ?, suitable_capacity = ?, current_capacity = ?, overload = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        db.run(query, [
            name.trim(),
            phone || null,
            id_card || null,
            province || null,
            city || null,
            county || null,
            town || null,
            village || null,
            detail_address || null,
            sheep_count || 0,
            cattle_count || 0,
            horse_count || 0,
            pasture_area || 0,
            fodder_area || 0,
            suitable_capacity || 0,
            current_capacity || 0,
            overload || 0,
            notes || null,
            farmerId
        ], function(err) {
            if (err) {
                console.error('更新农户失败:', err);
                res.status(500).json({ error: '更新农户失败' });
                return;
            }

            if (this.changes === 0) {
                res.status(404).json({ error: '农户不存在' });
                return;
            }

            res.json({ message: '农户信息更新成功' });
            db.close();
        });

    } catch (error) {
        console.error('更新农户失败:', error);
        res.status(500).json({ error: '更新农户失败' });
    }
});

// 删除农户
router.delete('/:id', async (req, res) => {
    try {
        const farmerId = req.params.id;
        const db = new sqlite3.Database(DB_PATH);
        
        // 检查是否有关联的检测任务
        db.get('SELECT COUNT(*) as count FROM detection_tasks WHERE farmer_id = ?', [farmerId], (err, row) => {
            if (err) {
                console.error('检查农户关联数据失败:', err);
                res.status(500).json({ error: '检查农户关联数据失败' });
                db.close();
                return;
            }
            
            if (row.count > 0) {
                res.status(400).json({ error: '该农户存在检测记录，无法删除' });
                db.close();
                return;
            }
            
            // 删除农户
            db.run('DELETE FROM farmers WHERE id = ?', [farmerId], function(err) {
                if (err) {
                    console.error('删除农户失败:', err);
                    res.status(500).json({ error: '删除农户失败' });
                    return;
                }
                
                if (this.changes === 0) {
                    res.status(404).json({ error: '农户不存在' });
                    return;
                }
                
                res.json({ message: '农户删除成功' });
                db.close();
            });
        });
        
    } catch (error) {
        console.error('删除农户失败:', error);
        res.status(500).json({ error: '删除农户失败' });
    }
});

// 获取农户的检测任务列表
router.get('/:id/tasks', async (req, res) => {
    try {
        const farmerId = req.params.id;
        const { status, sort = 'date_desc' } = req.query;
        
        const db = new sqlite3.Database(DB_PATH);
        
        let query = `
            SELECT 
                dt.*
            FROM detection_tasks dt
            WHERE dt.farmer_id = ?
        `;
        
        const params = [farmerId];
        
        // 状态筛选
        if (status) {
            query += ' AND dt.status = ?';
            params.push(status);
        }
        
        // 排序
        switch (sort) {
            case 'date_asc':
                query += ' ORDER BY dt.detection_date ASC';
                break;
            case 'date_desc':
            default:
                query += ' ORDER BY dt.detection_date DESC';
                break;
        }
        
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('查询检测任务失败:', err);
                res.status(500).json({ error: '查询检测任务失败' });
                return;
            }
            
            res.json({ tasks: rows });
            db.close();
        });
        
    } catch (error) {
        console.error('获取检测任务列表失败:', error);
        res.status(500).json({ error: '获取检测任务列表失败' });
    }
});

// 搜索农户
router.get('/search/:query', async (req, res) => {
    try {
        const searchQuery = req.params.query;
        const db = new sqlite3.Database(DB_PATH);
        
        const query = `
            SELECT 
                f.*,
                COUNT(dt.id) as total_detections,
                MAX(dt.detection_date) as last_detection_date
            FROM farmers f
            LEFT JOIN detection_tasks dt ON f.id = dt.farmer_id
            WHERE f.name LIKE ? OR f.phone LIKE ? OR f.detail_address LIKE ?
            GROUP BY f.id
            ORDER BY f.name
            LIMIT 50
        `;
        
        const searchPattern = `%${searchQuery}%`;
        
        db.all(query, [searchPattern, searchPattern, searchPattern], (err, rows) => {
            if (err) {
                console.error('搜索农户失败:', err);
                res.status(500).json({ error: '搜索农户失败' });
                return;
            }
            
            res.json({ farmers: rows });
            db.close();
        });
        
    } catch (error) {
        console.error('搜索农户失败:', error);
        res.status(500).json({ error: '搜索农户失败' });
    }
});

module.exports = router;
