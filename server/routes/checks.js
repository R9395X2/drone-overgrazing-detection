const express = require('express');
const router = express.Router();
const importService = require('../services/importService');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const DB_PATH = path.join(__dirname, '../../database/drone_detection.db');

/**
 * 获取所有检测任务，支持按农户ID筛选
 * GET /api/checks?farmer_id=xxx
 */
router.get('/', async (req, res) => {
    try {
        // 支持按农户ID筛选
        const { farmer_id } = req.query;
        console.log('checks api called', req.query); // 调试输出
        const db = new sqlite3.Database(DB_PATH);

        let query = `
            SELECT dt.*, f.name as farmer_name
            FROM detection_tasks dt
            LEFT JOIN farmers f ON dt.farmer_id = f.id
        `;
        const params = [];

        if (farmer_id) {
            query += ' WHERE dt.farmer_id = ?';
            params.push(farmer_id);
        }

        query += ' ORDER BY dt.created_at DESC';

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('查询检测任务失败:', err);
                res.status(500).json({ error: '查询检测任务失败' });
                return;
            }
            console.log('checks api result:', rows); // 调试输出
            res.json(rows);
            db.close();
        });
    } catch (error) {
        console.error('获取检测任务失败:', error);
        res.status(500).json({ error: '获取检测任务失败' });
    }
});

/**
 * 创建临时文件夹
 * POST /api/checks/temp-folder
 * 返回：{ tempFolderPath }
 */
router.post('/temp-folder', (req, res) => {
    try {
        const tempFolderPath = importService.createTempCheckFolder();
        res.json({ tempFolderPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 确认盘点，重命名文件夹并返回新路径
 * POST /api/checks/finalize
 * body: { tempFolderPath, checkId, farmerId, farmerName, date }
 * 返回：{ finalFolderPath }
 */
router.post('/finalize', (req, res) => {
    const { tempFolderPath, checkId, farmerId, farmerName, date } = req.body;
    if (!tempFolderPath || !checkId || !farmerId || !farmerName || !date) {
        return res.status(400).json({ error: '参数不完整' });
    }
    try {
        const finalFolderPath = importService.finalizeCheckFolder(
            tempFolderPath, checkId, farmerId, farmerName, date
        );
        // 此处可扩展：插入数据库盘点记录
        res.json({ finalFolderPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 删除盘点任务及其文件夹和所有结果
 * DELETE /api/checks/:taskId
 */
router.delete('/:taskId', async (req, res) => {
    const taskId = req.params.taskId;
    if (!taskId) return res.status(400).json({ error: '缺少taskId' });
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('database/drone_detection.db');
    db.get('SELECT media_folder_path FROM detection_tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) {
            db.close();
            return res.status(500).json({ error: '数据库查询失败' });
        }
        if (!row) {
            db.close();
            return res.status(404).json({ error: '未找到盘点任务' });
        }
        const mediaFolderPath = row.media_folder_path;
        // 删除文件夹
        try {
            const fs = require('fs');
            if (mediaFolderPath && fs.existsSync(mediaFolderPath)) {
                fs.rmSync(mediaFolderPath, { recursive: true, force: true });
            }
        } catch (e) {
            // 记录但不中断
            console.error('删除盘点文件夹失败:', e);
        }
        // 删除数据库记录
        db.run('DELETE FROM detection_tasks WHERE id = ?', [taskId], function (err2) {
            if (err2) {
                db.close();
                return res.status(500).json({ error: '删除detection_tasks失败' });
            }
            db.run('DELETE FROM count_results WHERE task_id = ?', [taskId], function (err3) {
                db.close();
                if (err3) {
                    return res.status(500).json({ error: '删除count_results失败' });
                }
                res.json({ success: true });
            });
        });
    });
});

module.exports = router;
