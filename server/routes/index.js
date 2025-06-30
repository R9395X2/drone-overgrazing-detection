/**
 * 路由模块汇总
 * 将原server.js中的所有API路由模块化
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

// 导入服务
const { 
    getImagesFromFolder, 
    getAllImagesFromDirectory, 
    getImageLibraryPath,
    getDrives 
} = require('../services/fileService');
const { detectDroneDevices } = require('../services/deviceService');
const { 
    copyImagesToLibraryByDate, 
    copyImagesToLibrary,
    markFolderAsImported,
    loadImportHistory,
    clearImportHistory
} = require('../services/importService');
const { 
    processImageWithScripts,
    validateImageFile 
} = require('../services/processService');

// 存储导入进度的全局变量
const importProgress = new Map();

/**
 * 设置所有API路由
 */
function setupRoutes(app) {
    // 应用配置API（已在server/routes/config.js中实现）
    app.use('/api/config', require('./config'));
    
    // 农户管理API
    app.use('/api/farmers', require('./farmers'));

    // 盘点管理API
    app.use('/api/checks', require('./checks'));

    // 临时目录API
    app.use('/api/temp-folder', require('./temp-folder'));
    // 导入文件夹API
    app.use('/api/import-folder', require('./import-folder'));
    // 计数相关API
    app.use('/api/count', require('./count'));

    // 新增：根据taskId获取盘点任务详情（含media_folder_path）
    app.get('/api/detection-task/:id', (req, res) => {
        const sqlite3 = require('sqlite3').verbose();
        const dbPath = path.join(__dirname, '../../database/drone_detection.db');
        const db = new sqlite3.Database(dbPath);
        const taskId = req.params.id;
        db.get('SELECT * FROM detection_tasks WHERE id = ?', [taskId], (err, row) => {
            if (err) {
                console.error('查询盘点任务失败:', err);
                res.status(500).json({ error: '查询盘点任务失败' });
                db.close();
                return;
            }
            if (!row) {
                res.status(404).json({ error: '未找到盘点任务' });
                db.close();
                return;
            }
            res.json(row);
            db.close();
        });
    });
    
    // 加载默认目录图片
    app.get('/api/images/default', async (req, res) => {
        try {
            const libraryPath = getImageLibraryPath();
            if (!fs.existsSync(libraryPath)) {
                return res.status(404).json({ error: '图像库目录不存在' });
            }
            // 只返回图库下所有图片，跳过所有result目录
            const images = getAllImagesFromDirectory(libraryPath, libraryPath);
            res.json({
                success: true,
                path: libraryPath,
                images: images,
                count: images.length
            });
        } catch (error) {
            console.error('加载默认目录图片错误:', error);
            res.status(500).json({ error: '加载默认目录图片失败' });
        }
    });

    // 获取驱动器和文件夹结构
    app.get('/api/browse', (req, res) => {
        const { path: requestPath } = req.query;
        
        try {
            let currentPath = requestPath || '';
            let folders = [];
            let parent = null;
            
            if (!currentPath) {
                // 返回所有驱动器
                const drives = getDrives();
                folders = drives.map(drive => ({
                    name: `${drive}\\`,
                    path: `${drive}\\`,
                    type: 'drive',
                    hasChildren: true
                }));
            } else {
                // 返回指定路径下的文件夹
                if (!fs.existsSync(currentPath)) {
                    return res.status(404).json({ error: '路径不存在' });
                }
                
                const parentPath = path.dirname(currentPath);
                if (parentPath !== currentPath) {
                    parent = parentPath;
                }
                
                const items = fs.readdirSync(currentPath);
                
                folders = items
                    .map(item => {
                        const itemPath = path.join(currentPath, item);
                        try {
                            const stats = fs.statSync(itemPath);
                            if (stats.isDirectory()) {
                                return {
                                    name: item,
                                    path: itemPath,
                                    type: 'folder',
                                    hasChildren: true
                                };
                            }
                        } catch (error) {
                            // 忽略无法访问的文件夹
                        }
                        return null;
                    })
                    .filter(item => item !== null)
                    .sort((a, b) => a.name.localeCompare(b.name));
            }
            
            res.json({
                success: true,
                currentPath: currentPath,
                parent: parent,
                folders: folders
            });
            
        } catch (error) {
            console.error('浏览文件夹错误:', error);
            res.status(500).json({ error: '浏览文件夹失败' });
        }
    });

    // 选择文件夹
    app.post('/api/select-folder', (req, res) => {
        const { folderPath } = req.body;

        if (!folderPath) {
            return res.status(400).json({ error: '请提供文件夹路径' });
        }

        try {
            const thumbDir = path.join(folderPath, 'thumb');
            if (!fs.existsSync(thumbDir)) {
                return res.status(404).json({ error: '缩略图目录不存在' });
            }

            const images = getImagesFromFolder(thumbDir);

            res.json({
                success: true,
                path: thumbDir,
                images: images,
                count: images.length
            });
        } catch (error) {
            console.error('选择文件夹错误:', error);
            res.status(500).json({ error: '读取文件夹失败' });
        }
    });

    // 自动检测设备
    app.get('/api/detect-devices', (req, res) => {
        try {
            const devices = detectDroneDevices();
            
            res.json({
                success: true,
                devices: devices,
                count: devices.length
            });
        } catch (error) {
            console.error('设备检测错误:', error);
            res.status(500).json({ error: '设备检测失败' });
        }
    });

    // 导入设备子文件夹（按时间分类复制到图像库，带进度支持）
    app.post('/api/import-device-folder-with-progress', async (req, res) => {
        const { folderPath } = req.body;
        
        if (!folderPath) {
            return res.status(400).json({ error: '请提供文件夹路径' });
        }
        
        try {
            if (!fs.existsSync(folderPath)) {
                return res.status(404).json({ error: '文件夹不存在' });
            }
            
            const folderName = path.basename(folderPath);
            const importId = Date.now().toString();
            
            // 初始化进度
            importProgress.set(importId, {
                phase: 'starting',
                current: 0,
                total: 0,
                message: '正在初始化导入...'
            });
            
            // 异步执行导入，立即返回导入ID
            res.json({
                success: true,
                importId: importId,
                message: '导入已开始，请通过进度API查看状态'
            });
            
            // 在后台执行导入
            setImmediate(async () => {
                try {
                    const progressCallback = (progress) => {
                        importProgress.set(importId, progress);
                    };
                    
                    // 按时间分类复制图片到图像库
                    const copyResult = await copyImagesToLibraryByDate(folderPath, folderName, progressCallback);
                    
                    // 标记文件夹为已导入
                    markFolderAsImported(folderPath, copyResult.copiedCount);
                    
                    // 更新最终结果
                    importProgress.set(importId, {
                        phase: 'completed',
                        current: copyResult.totalCount,
                        total: copyResult.totalCount,
                        message: '导入完成！现在可以安全地拔掉USB设备了。',
                        result: {
                            path: copyResult.targetFolder,
                            images: copyResult.images,
                            count: copyResult.copiedCount,
                            imported: true,
                            copyStats: {
                                total: copyResult.totalCount,
                                copied: copyResult.copiedCount,
                                errors: copyResult.errorCount
                            },
                            dateGroups: copyResult.dateGroups,
                            canRemoveDevice: true
                        }
                    });
                    
                } catch (error) {
                    console.error('导入设备文件夹错误:', error);
                    importProgress.set(importId, {
                        phase: 'error',
                        current: 0,
                        total: 0,
                        message: '导入失败: ' + error.message,
                        error: error.message
                    });
                }
            });
            
        } catch (error) {
            console.error('导入设备文件夹错误:', error);
            res.status(500).json({ error: '导入设备文件夹失败: ' + error.message });
        }
    });

    // 获取导入进度
    app.get('/api/import-progress/:importId', (req, res) => {
        const { importId } = req.params;
        
        const progress = importProgress.get(importId);
        if (!progress) {
            return res.status(404).json({ error: '导入任务不存在' });
        }
        
        res.json({
            success: true,
            progress: progress
        });
        
        // 如果任务完成或出错，清理进度数据（延迟清理）
        if (progress.phase === 'completed' || progress.phase === 'error') {
            setTimeout(() => {
                importProgress.delete(importId);
            }, 60000); // 1分钟后清理
        }
    });

    // 处理图片 - 使用配置的脚本
    app.post('/api/process-image', async (req, res) => {
        const { imagePath, selectedScripts } = req.body;
        
        if (!imagePath) {
            return res.status(400).json({ error: '请提供图片路径' });
        }
        
        try {
            validateImageFile(imagePath);
            
            const startTime = Date.now();
            
            // 调用配置的Python脚本处理图片
            const scriptResults = await processImageWithScripts(imagePath, selectedScripts);
            
            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
            
            const result = {
                success: true,
                imageName: path.basename(imagePath),
                imagePath: imagePath,
                processingTime: `${processingTime}秒`,
                scriptResults: scriptResults,
                summary: {
                    totalScripts: scriptResults.length,
                    successfulScripts: scriptResults.filter(r => r.success).length,
                    failedScripts: scriptResults.filter(r => !r.success).length
                }
            };
            
            res.json(result);
            
        } catch (error) {
            console.error('图片处理错误:', error);
            res.status(500).json({ 
                error: '图片处理失败',
                details: error.message 
            });
        }
    });

    // 获取缩略图
    app.get('/api/thumbnail', (req, res) => {
        const { path: imagePath } = req.query;
        
        if (!imagePath) {
            return res.status(400).json({ error: '请提供图片路径' });
        }
        
        try {
            if (!fs.existsSync(imagePath)) {
                return res.status(404).json({ error: '图片文件不存在' });
            }
            
            // 这里应该生成实际的缩略图
            // 暂时直接返回原图
            res.sendFile(path.resolve(imagePath));
        } catch (error) {
            console.error('获取缩略图错误:', error);
            res.status(500).json({ error: '获取缩略图失败' });
        }
    });

    // 导入历史管理
    app.get('/api/import-history', (req, res) => {
        try {
            const history = loadImportHistory();
            res.json({
                success: true,
                history: history
            });
        } catch (error) {
            console.error('获取导入历史错误:', error);
            res.status(500).json({ error: '获取导入历史失败' });
        }
    });

    app.delete('/api/import-history', (req, res) => {
        try {
            const success = clearImportHistory();
            
            if (success) {
                res.json({ success: true, message: '导入历史已清除' });
            } else {
                res.status(500).json({ error: '清除导入历史失败' });
            }
        } catch (error) {
            console.error('清除导入历史错误:', error);
            res.status(500).json({ error: '清除导入历史失败' });
        }
    });

    // 批量删除图片API
    app.delete('/api/delete-image', (req, res) => {
        const { imagePaths } = req.body;
        const farmerId = req.query.farmerId || req.query.farmer_id;
        const taskId = req.query.taskId || req.query.task_id;
        if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
            return res.status(400).json({ error: '请提供要删除的图片路径数组 imagePaths' });
        }
        const results = [];
        const deletedFileNames = new Set();
        console.log('delete-image imagePaths:', imagePaths);
        imagePaths.forEach(imagePath => {
            try {
                const dir = path.dirname(imagePath);
                const fileName = path.basename(imagePath);
                const baseName = fileName.replace(/\.[^.]+$/, '');
                // 需要删除的所有相关文件
                const folders = ['original', 'result', 'thumb'];
                const exts = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG', '.txt'];
                let deletedAny = false;
folders.forEach(folder => {
    const folderDir = dir.replace(/(original|result|thumb)/, folder);
    if (fs.existsSync(folderDir)) {
        const files = fs.readdirSync(folderDir);
        files.forEach(f => {
            const fBase = f.replace(/\.[^.]+$/, '');
            const fExt = path.extname(f);
            // 只要baseName相同且后缀为目标类型（不区分大小写），就删除
            if (
                fBase === baseName &&
                exts.some(ext => ext.toLowerCase() === fExt.toLowerCase())
            ) {
                const filePath = path.join(folderDir, f);
                try {
                    fs.unlinkSync(filePath);
                    results.push({ path: filePath, success: true });
                    deletedAny = true;
                } catch (err) {
                    results.push({ path: filePath, success: false, error: err.message });
                }
            }
        });
    }
});
                // 兼容直接传入的路径
                if (fs.existsSync(imagePath)) {
                    try {
                        fs.unlinkSync(imagePath);
                        results.push({ path: imagePath, success: true });
                        deletedAny = true;
                    } catch (err) {
                        results.push({ path: imagePath, success: false, error: err.message });
                    }
                }
                if (!deletedAny) {
                    results.push({ path: imagePath, success: false, error: '文件不存在' });
                }
                // 无论文件是否实际被删除，都收集图片名和txt名用于数据库删除
                deletedFileNames.add(fileName);
                deletedFileNames.add(baseName + '.txt');
            } catch (err) {
                results.push({ path: imagePath, success: false, error: err.message });
            }
        });
        console.log('delete-image deletedFileNames:', Array.from(deletedFileNames));
        
        // 数据库删除
        if (deletedFileNames.size > 0) {
            const sqlite3 = require('sqlite3').verbose();
            const dbPath = path.join(__dirname, '../../database/drone_detection.db');
            const db = new sqlite3.Database(dbPath);
            const namesArr = Array.from(deletedFileNames);
            const placeholders = namesArr.map(() => '?').join(',');
            if (farmerId) {
                // 无视文件名大小写删除
                db.run(
                    `DELETE FROM temp_count_results WHERE LOWER(file_name) IN (${placeholders})`,
                    namesArr.map(x => x.toLowerCase()),
                    function(err) {
                        db.close();
                        if (err) {
                            return res.status(500).json({ error: '数据库删除失败', details: err.message, results });
                        }
                        res.json({ results, deletedRows: this && this.changes });
                    }
                );
                return;
            } else if (taskId) {
                db.run(
                    `DELETE FROM count_results WHERE file_name IN (${placeholders}) AND task_id = ?`,
                    [...namesArr, taskId],
                    function(err) {
                        db.close();
                        if (err) {
                            return res.status(500).json({ error: '数据库删除失败', details: err.message, results });
                        }
                        res.json({ results });
                    }
                );
                return;
            } else {
                db.run(
                    `DELETE FROM count_results WHERE file_name IN (${placeholders})`,
                    namesArr,
                    function(err) {
                        db.close();
                        if (err) {
                            return res.status(500).json({ error: '数据库删除失败', details: err.message, results });
                        }
                        res.json({ results });
                    }
                );
                return;
            }
        }
        res.json({ results });
    });

    // 兼容性路由
    app.get('/api/app-config', (req, res) => res.redirect('/api/config/app'));
    app.post('/api/app-config', (req, res) => res.redirect(307, '/api/config/app'));
}

module.exports = { setupRoutes };
