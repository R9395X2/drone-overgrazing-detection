// 临时目录API
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const MEDIA_GALLERY_ROOT = path.resolve(__dirname, '../../MediaGallery');

const TEMP_DIR_NAME = 'temp_folder';

const ORIGINAL_DIR = path.join(MEDIA_GALLERY_ROOT, TEMP_DIR_NAME, 'original');

const RESULT_DIR = path.join(MEDIA_GALLERY_ROOT, TEMP_DIR_NAME, 'result');

// 引入fileService用于格式化文件大小
const fileService = require('../services/fileService');

// 获取图片列表（支持original子目录），并判断是否已处理
function getImagesInDir(dirPath, webPrefix) {
    if (!fs.existsSync(dirPath)) return [];
    // 获取result目录所有文件（不含子目录），用于判断已处理
    let resultFiles = [];
    if (fs.existsSync(RESULT_DIR)) {
        resultFiles = fs.readdirSync(RESULT_DIR)
            .filter(f => /\.(jpg|jpeg|png|bmp|gif)$/i.test(f))
            .map(f => f.replace(/\.[^.]+$/, '').toLowerCase());
    }
    const files = fs.readdirSync(dirPath);
    return files.filter(f => /\.(jpg|jpeg|png|bmp|gif)$/i.test(f)).map(f => {
        const filePath = path.join(dirPath, f);
        let stat;
        try {
            stat = fs.statSync(filePath);
        } catch {
            stat = null;
        }
        // 判断result目录下是否有同名（不含后缀）文件
        const baseName = f.replace(/\.[^.]+$/, '').toLowerCase();
        const processed = resultFiles.includes(baseName);
        return {
            name: f,
            path: filePath,
            thumbnail: `${webPrefix}/${f}`,
            size: stat ? fileService.formatFileSize(stat.size) : '',
            sizeBytes: stat ? stat.size : '',
            date: stat ? stat.mtime.toLocaleString('zh-CN') : '',
            dateTime: stat ? stat.mtime.toISOString() : '',
            processed
        };
    });
}

// GET /api/temp-folder
router.get('/', (req, res) => {
    const dirPath = path.join(MEDIA_GALLERY_ROOT, TEMP_DIR_NAME);

    // 创建目录（如果不存在）
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    // 创建原图、结果、缩略图子文件夹
    const subDirs = ['original', 'result', 'thumb'];
    subDirs.forEach(sub => {
        const subPath = path.join(dirPath, sub);
        if (!fs.existsSync(subPath)) {
            fs.mkdirSync(subPath, { recursive: true });
            // console.log('[temp-folder] 创建子文件夹:', subPath);
        }
    });

    // 返回original目录和图片列表
    const images = getImagesInDir(ORIGINAL_DIR, `/MediaGallery/${TEMP_DIR_NAME}/original`);
    res.json({
        path: `/MediaGallery/${TEMP_DIR_NAME}/original`,
        images
    });
});

/**
 * 删除临时文件夹及内容
 */
router.delete('/', (req, res) => {
    const dirPath = path.join(MEDIA_GALLERY_ROOT, TEMP_DIR_NAME);
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
    // 清空数据库临时表
    try {
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('database/drone_detection.db');
        db.run('DELETE FROM temp_count_results', [], function(err) {
            db.close();
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
