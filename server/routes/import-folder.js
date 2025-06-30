const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

/**
 * 递归复制文件夹内容
 */
function copyFolderRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyFolderRecursiveSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

const MEDIA_GALLERY_ROOT = path.resolve(__dirname, '../../MediaGallery');
const TEMP_ORIGINAL_DIR = path.join(MEDIA_GALLERY_ROOT, 'temp_folder', 'original');

// POST /api/import-folder
router.post('/', (req, res) => {
    const { from } = req.body;
    if (!from) {
        return res.status(400).json({ error: '参数from不能为空' });
    }
    try {
        // 保留original目录已有文件，不做清空
        fs.mkdirSync(TEMP_ORIGINAL_DIR, { recursive: true });
        // 复制内容到original
        copyFolderRecursiveSync(from, TEMP_ORIGINAL_DIR);
        // 生成缩略图
        const sharp = require('sharp');
        const TEMP_THUMB_DIR = path.join(MEDIA_GALLERY_ROOT, 'temp_folder', 'thumb');
        if (!fs.existsSync(TEMP_THUMB_DIR)) {
            fs.mkdirSync(TEMP_THUMB_DIR, { recursive: true });
        }
        const images = [];
        if (fs.existsSync(TEMP_ORIGINAL_DIR)) {
            const files = fs.readdirSync(TEMP_ORIGINAL_DIR);
            files.forEach(f => {
if (/\.(jpg|jpeg|png|bmp|gif)$/i.test(f)) {
    images.push({
        name: f,
        path: path.join(TEMP_ORIGINAL_DIR, f)
    });
    // 生成缩略图
    const srcPath = path.join(TEMP_ORIGINAL_DIR, f);
    const thumbPath = path.join(TEMP_THUMB_DIR, f);
    // 若缩略图已存在则跳过
    if (!fs.existsSync(thumbPath)) {
        sharp(srcPath)
            .resize(220, 220, { fit: 'inside' })
            .toFile(thumbPath)
            .catch(() => {});
    }
}
            });
        }
        res.json({ path: TEMP_ORIGINAL_DIR, images });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
