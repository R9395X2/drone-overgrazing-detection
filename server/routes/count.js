const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const sqlite3 = require('sqlite3').verbose();

/**
 * 统一写入计数结果到数据库，并返回图片URL和计数
 */
function saveCountResultsToDB({ resultDir, imgPath, outputDir, animalType }, callback) {
    const files = fs.existsSync(resultDir) ? fs.readdirSync(resultDir) : [];
    const db = new sqlite3.Database('database/drone_detection.db');
    let results = [];
    // 支持的图片扩展名
    const exts = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'];
    // 遍历所有图片文件
    files.filter(f => exts.some(ext => f.endsWith(ext))).forEach(imgFile => {
        const imgBase = imgFile.replace(/\.[^.]+$/, '');
        const txtFile = imgBase + '.txt';
        const txtPath = path.join(resultDir, txtFile);
        let countResult = '';
        try {
            countResult = fs.readFileSync(txtPath, 'utf-8').trim();
        } catch (e) {
            countResult = '';
        }
        const file_name = imgFile.toLowerCase();
        const file_path = path.join(imgPath, imgFile).replace(/\.JPG$/i, '.jpg').replace(/\.JPEG$/i, '.jpeg').replace(/\.PNG$/i, '.png');
        const resultImg = path.join(outputDir, 'result', imgFile);
        const resultImageUrl = fs.existsSync(resultImg)
            ? '/' + path.relative(path.resolve('./'), resultImg).replace(/\\/g, '/')
            : '';
        const count = parseInt(countResult) || 0;
        let sheep_count = 0, cattle_count = 0;
        // 只对当前图片赋值，不影响其它图片
        if (animalType === 'sheep') {
            sheep_count = count;
            cattle_count = 0;
        } else if (animalType === 'cattle') {
            sheep_count = 0;
            cattle_count = count;
        } else if (animalType === 'both') {
            sheep_count = count;
            cattle_count = count;
        }
        db.run(
            `INSERT OR REPLACE INTO temp_count_results (file_name, file_path, algorithm_name, sheep_count, cattle_count, status, manual_cattle_count, manual_sheep_count, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))`,
            [file_name, file_path, 'NKY', sheep_count, cattle_count, 'completed', null, null, null]
        );
        results.push({
            file_name,
            file_path,
            resultImageUrl,
            countResult
        });
    });
    db.close();
    callback && callback(results);
}

/**
 * 单张图片计数接口：只更新当前图片
 */
router.post('/single', async (req, res) => {
    try {
        const { imgPath, outputDir, animalType } = req.body;
        if (!imgPath || !outputDir || !animalType) {
            return res.status(400).json({ error: '参数不完整' });
        }
        const pyCmd = `D:/bao/env/conda/Library/bin/conda.bat activate numsheep && python -W ignore D:/drone-overgrazing-detection/yoloNumSheepNKY/run.py --img_path "${imgPath}" --output_dir "${outputDir}" --animal "${animalType}"`;
        exec(pyCmd, { shell: true }, (error, stdout, stderr) => {
            // 只处理当前图片
            const imgName = path.basename(imgPath).toLowerCase();
            const resultDir = path.join(outputDir, 'result');
            const imgBase = imgName.replace(/\.[^.]+$/, '');
            const txtFile = imgBase + '.txt';
            const txtPath = path.join(resultDir, txtFile);
            let countResult = '';
            try {
                countResult = fs.readFileSync(txtPath, 'utf-8').trim();
            } catch (e) {
                countResult = '';
            }
            const file_name = imgName.toLowerCase();
            const file_path = imgPath.replace(/\.JPG$/i, '.jpg').replace(/\.JPEG$/i, '.jpeg').replace(/\.PNG$/i, '.png');
            const resultImg = path.join(outputDir, 'result', imgName);
            const resultImageUrl = fs.existsSync(resultImg)
                ? '/' + path.relative(path.resolve('./'), resultImg).replace(/\\/g, '/')
                : '';
            const count = parseInt(countResult) || 0;
            let sheep_count = 0, cattle_count = 0;
            if (animalType === 'sheep') {
                sheep_count = count;
                cattle_count = 0;
            } else if (animalType === 'cattle') {
                sheep_count = 0;
                cattle_count = count;
            } else if (animalType === 'both') {
                sheep_count = count;
                cattle_count = count;
            }
            const db = new sqlite3.Database('database/drone_detection.db');
            db.run(
                `INSERT OR REPLACE INTO temp_count_results (file_name, file_path, algorithm_name, sheep_count, cattle_count, status, manual_cattle_count, manual_sheep_count, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))`,
                [file_name, file_path, 'NKY', sheep_count, cattle_count, 'completed', null, null, null],
                function(err) {
                    db.close();
                    res.json({
                        countResult,
                        resultImageUrl,
                        stdout,
                        stderr,
                        error: error ? error.message : ''
                    });
                }
            );
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 滑窗计数接口
 * POST /api/count/slide
 * body: { imgPath, outputDir }
 */
/**
 * 滑窗计数接口：只更新当前图片
 */
router.post('/slide', async (req, res) => {
    try {
        const { imgPath, outputDir, animalType } = req.body;
        if (!imgPath || !outputDir || !animalType) {
            return res.status(400).json({ error: '参数不完整' });
        }
        const pyCmd = `D:/bao/env/conda/Library/bin/conda.bat activate numsheep && python -W ignore D:/drone-overgrazing-detection/yoloNumSheepNKY/滑框切图.py --image_path "${imgPath}" --output_dir "${outputDir}" --animal "${animalType}"`;
        exec(pyCmd, { shell: true }, (error, stdout, stderr) => {
            // 只处理当前图片
            const imgName = path.basename(imgPath);
            const resultDir = path.join(outputDir, 'result');
            const imgBase = imgName.replace(/\.[^.]+$/, '');
            const txtFile = imgBase + '.txt';
            const txtPath = path.join(resultDir, txtFile);
            let countResult = '';
            try {
                countResult = fs.readFileSync(txtPath, 'utf-8').trim();
            } catch (e) {
                countResult = '';
            }
            const file_name = imgName;
            const file_path = imgPath.replace(/\.JPG$/i, '.jpg').replace(/\.JPEG$/i, '.jpeg').replace(/\.PNG$/i, '.png');
            const resultImg = path.join(outputDir, 'result', imgName);
            const resultImageUrl = fs.existsSync(resultImg)
                ? '/' + path.relative(path.resolve('./'), resultImg).replace(/\\/g, '/')
                : '';
            const count = parseInt(countResult) || 0;
            let sheep_count = 0, cattle_count = 0;
            if (animalType === 'sheep') {
                sheep_count = count;
                cattle_count = 0;
            } else if (animalType === 'cattle') {
                sheep_count = 0;
                cattle_count = count;
            } else if (animalType === 'both') {
                sheep_count = count;
                cattle_count = count;
            }
            const db = new sqlite3.Database('database/drone_detection.db');
            db.run(
                `INSERT OR REPLACE INTO temp_count_results (file_name, file_path, algorithm_name, sheep_count, cattle_count, status, manual_cattle_count, manual_sheep_count, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))`,
                [file_name, file_path, 'NKY', sheep_count, cattle_count, 'completed', null, null, null],
                function(err) {
                    db.close();
                    res.json({
                        countResult,
                        resultImageUrl,
                        stdout,
                        stderr,
                        error: error ? error.message : ''
                    });
                }
            );
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 查询计数结果接口
 * GET /api/count/result?fileName=xxx[&taskId=xx][&farmerId=xx]
 */
router.get('/result', (req, res) => {
    const { fileName, taskId, farmerId } = req.query;
    if (!fileName) {
        return res.status(400).json({ error: '参数不完整' });
    }
    const db = new sqlite3.Database('database/drone_detection.db');
    if (farmerId) {
        // 临时盘点，查 temp_count_results
        const sql = 'SELECT sheep_count, cattle_count, status, manual_sheep_count, manual_cattle_count, manual_verified FROM temp_count_results WHERE file_name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1';
        db.get(sql, [fileName], (err, row) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.json({ sheep_count: null, cattle_count: null, status: null, manual_sheep_count: null, manual_cattle_count: null, manual_verified: 0 });
            }
            res.json({
                sheep_count: row.sheep_count,
                cattle_count: row.cattle_count,
                status: row.status,
                manual_sheep_count: row.manual_sheep_count,
                manual_cattle_count: row.manual_cattle_count,
                manual_verified: row.manual_verified
            });
        });
    } else if (taskId) {
        // 正式盘点，查 count_results
        const sql = 'SELECT sheep_count, cattle_count, status, manual_sheep_count, manual_cattle_count, manual_verified FROM count_results WHERE task_id = ? AND file_name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1';
        db.get(sql, [taskId, fileName], (err, row) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.json({ sheep_count: null, cattle_count: null, status: null });
            }
            // 优先用人工修正
            let sheep, cattle;
            if (row.manual_verified === 1) {
                sheep = (row.manual_sheep_count !== null && row.manual_sheep_count !== undefined) ? row.manual_sheep_count : row.sheep_count;
                cattle = (row.manual_cattle_count !== null && row.manual_cattle_count !== undefined) ? row.manual_cattle_count : row.cattle_count;
            } else {
                sheep = row.sheep_count;
                cattle = row.cattle_count;
            }
            res.json({ sheep_count: sheep, cattle_count: cattle, status: row.status });
        });
    } else {
        // 默认查 count_results，取最新一条
        const sql = 'SELECT sheep_count, cattle_count, status FROM count_results WHERE file_name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1';
        db.get(sql, [fileName], (err, row) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.json({ sheep_count: null, cattle_count: null, status: null });
            }
            res.json({ sheep_count: row.sheep_count, cattle_count: row.cattle_count, status: row.status });
        });
    }
});

/**
 * 全部图片计数接口
 * POST /api/count/all
 * body: { imgPath, outputDir, animalType }
 */
router.post('/all', async (req, res) => {
    try {
        const { imgPath, outputDir, animalType } = req.body;
        if (!imgPath || !outputDir || !animalType) {
            return res.status(400).json({ error: '参数不完整' });
        }
        // 拼接命令，imgPath为文件夹
        const pyCmd = `D:/bao/env/conda/Library/bin/conda.bat activate numsheep && python -W ignore D:/drone-overgrazing-detection/yoloNumSheepNKY/run.py --img_path "${imgPath}" --output_dir "${outputDir}" --animal "${animalType}"`;

        // 流式响应
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        const { spawn } = require('child_process');
        const child = spawn(pyCmd, { shell: true });

        child.stdout.on('data', (data) => {
            res.write(data);
            res.flush && res.flush();
        });

        child.stderr.on('data', (data) => {
            res.write(data);
            res.flush && res.flush();
        });

        child.on('close', (code) => {
            // 处理完毕后写入数据库
            const resultDir = path.join(outputDir, 'result');
            saveCountResultsToDB({ resultDir, imgPath, outputDir, animalType }, (results) => {
                res.write('\n__COUNT_DONE__\n');
                res.end();
            });
        });

        child.on('error', (err) => {
            res.write(`\n__COUNT_ERROR__\n${err.message}\n`);
            res.end();
        });
    } catch (e) {
        res.status(500).end('error: ' + e.message);
    }
});

/**
 * 完成盘点：保存盘点信息并归档计数结果
 * POST /api/count/finish-inventory
 * body: { task_name, detection_date, notes }
 */
router.post('/finish-inventory', async (req, res) => {
    try {
        // 前端传递的字段
        const { task_name, detection_date, notes, pilot_name } = req.body;
        if (!task_name || !detection_date) {
            return res.status(400).json({ error: '参数不完整' });
        }
        // detection_date补全时分秒
        let fullDetectionDate = detection_date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(detection_date)) {
            // 只有日期，补全当前时分秒
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            fullDetectionDate = `${detection_date} ${hh}:${mm}:${ss}`;
        }
        const db = new sqlite3.Database('database/drone_detection.db');
        // 统计sheep_count、cattle_count、total_files、processed_files
        db.all('SELECT * FROM temp_count_results', [], (err2, rows) => {
            if (err2) {
                db.close();
                return res.status(500).json({ error: err2.message });
            }
            let sheep_count = 0, cattle_count = 0, total_files = 0, processed_files = 0;
            rows.forEach(row => {
                // 优先用manual_verified=1的manual字段，否则用sheep_count/cattle_count
                if (row.manual_verified === 1) {
                    sheep_count += row.manual_sheep_count || 0;
                    cattle_count += row.manual_cattle_count || 0;
                } else {
                    sheep_count += row.sheep_count || 0;
                    cattle_count += row.cattle_count || 0;
                }
                total_files += 1;
                if (row.status === 'completed') processed_files += 1;
            });

            // 自动获取/推断的字段
            // farmer_id、media_folder_path、media_type、status
            // 这里假设farmer_id、media_folder_path、media_type可从第一个row推断，status固定为'completed'
            let farmer_id = null, media_folder_path = null, media_type = 'image', status = 'completed';
            // farmer_id可从前端传递
            farmer_id = req.body.farmer_id || null;
            // media_folder_path = MediaGallery\{farmerId}_{detection_date}_{task_name}
            // 规范化task_name（去除特殊字符和空格）
            let safeTaskName = (task_name || '').replace(/[\\\/:*?"<>| ]+/g, '_');
            let safeDate = (detection_date || '').replace(/[^0-9]/g, '');
            media_folder_path = `MediaGallery\\${farmer_id || 'unknown'}_${safeDate}_${safeTaskName}`;

            // 1. 插入detection_tasks
            db.run(
                `INSERT INTO detection_tasks 
                (farmer_id, task_name, detection_date, sheep_count, cattle_count, media_folder_path, media_type, total_files, processed_files, pilot_name, status, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))`,
                [
                    farmer_id,
                    task_name,
                    detection_date,
                    sheep_count,
                    cattle_count,
                    media_folder_path,
                    media_type,
                    total_files,
                    processed_files,
                    pilot_name || null,
                    status,
                    notes || null
                ],
                async function (err) {
                    if (err) {
                        db.close();
                        return res.status(500).json({ error: err.message });
                    }
                    const task_id = this.lastID;
    // 2. 复制temp_folder内容到media_folder_path
    let copySuccess = false;
    try {
        const fs = require('fs');
        const path = require('path');
        const tempFolder = path.join('MediaGallery', 'temp_folder');
        const targetFolder = media_folder_path;
        function copyDir(src, dest) {
            if (!fs.existsSync(src)) return;
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            const entries = fs.readdirSync(src, { withFileTypes: true });
            for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);
                if (entry.isDirectory()) {
                    copyDir(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        }
        if (fs.existsSync(tempFolder)) {
            if (!fs.existsSync(targetFolder)) {
                copyDir(tempFolder, targetFolder);
                copySuccess = true;
            }
            // 不覆盖已存在的目标文件夹
        }
    } catch (e) {
        console.error('复制temp_folder内容失败:', e);
    }

                    // 3. 重新查询temp_count_results，插入到count_result，file_path替换为新文件夹
                    db.all('SELECT * FROM temp_count_results', [], (err3, tempRows) => {
                        if (err3) {
                            db.close();
                            return res.status(500).json({ error: err3.message });
                        }
                        const insertStmt = db.prepare(
                            `INSERT INTO count_results
                            (task_id, file_name, file_path, algorithm_name, sheep_count, cattle_count, status, manual_cattle_count, manual_sheep_count, manual_verified, notes, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))`
                        );
                        tempRows.forEach(row => {
                            // 替换file_path中的temp_folder为media_folder_path
                            let newFilePath = row.file_path;
                            if (typeof newFilePath === 'string') {
                                newFilePath = newFilePath.replace(/MediaGallery[\\/]+temp_folder/, media_folder_path.replace(/\//g, '\\'));
                            }
                            insertStmt.run([
                                task_id,
                                row.file_name,
                                newFilePath,
                                row.algorithm_name,
                                row.sheep_count,
                                row.cattle_count,
                                row.status,
                                row.manual_cattle_count,
                                row.manual_sheep_count,
                                row.manual_verified || 0,
                                row.notes
                            ]);
                        });
                        insertStmt.finalize();

                        // 4. 清空temp_count_results
                        db.run('DELETE FROM temp_count_results', [], async (err4) => {
                            db.close();
                            // 调用本地DELETE /api/temp-folder清理临时文件夹
                            try {
                                const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
                                await fetch('http://127.0.0.1:3000/api/temp-folder', { method: 'DELETE' });
                            } catch (e) {
                                console.error('自动清理临时文件夹失败:', e);
                            }
                            res.json({ success: true, task_id });
                        });
                    });
                }
            );
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 覆盖图片计数结果
 * POST /api/count/override-result
 * body: { fileName, sheep_count, cattle_count }
 */
router.post('/override-result', async (req, res) => {
    const { fileName, sheep_count, cattle_count } = req.body;
    if (!fileName || typeof sheep_count !== 'number' || typeof cattle_count !== 'number') {
        return res.status(400).json({ error: '参数不完整' });
    }
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('database/drone_detection.db');
    function runAsync(sql, params) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
    function getAsync(sql, params) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, function(err, row) {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    try {
        // 先尝试更新
        const result = await runAsync(
            `UPDATE temp_count_results SET sheep_count=?, cattle_count=?, status='completed' WHERE file_name=? COLLATE NOCASE`,
            [sheep_count, cattle_count, fileName]
        );
        // 如果没有记录被更新，则插入
        if (result.changes === 0) {
            await runAsync(
`INSERT OR REPLACE INTO temp_count_results (file_name, sheep_count, cattle_count, status) VALUES (?, ?, ?, 'completed')`,
                [fileName, sheep_count, cattle_count]
            );
        }
        db.close();
        res.json({ success: true });
    } catch (err) {
        db.close();
        res.status(500).json({ error: err.message });
    }
});

/**
 * 手动修正计数结果
 * POST /api/count/manual-correct
 * body: { fileName, manual_sheep_count, manual_cattle_count, manual_verified, farmer_id }
 */
router.post('/manual-correct', async (req, res) => {
    const { fileName, manual_sheep_count, manual_cattle_count, manual_verified } = req.body;
    if (!fileName || typeof manual_sheep_count !== 'number' || typeof manual_cattle_count !== 'number') {
        return res.status(400).json({ error: '参数不完整' });
    }
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('database/drone_detection.db');
    function runAsync(sql, params) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
    try {
        // 先尝试更新
        const result = await runAsync(
            `UPDATE temp_count_results SET manual_sheep_count=?, manual_cattle_count=?, manual_verified=? WHERE file_name=? COLLATE NOCASE`,
            [manual_sheep_count, manual_cattle_count, manual_verified || 1, fileName]
        );
        // 如果没有记录被更新，则插入
        if (result.changes === 0) {
            await runAsync(
`INSERT OR REPLACE INTO temp_count_results (file_name, manual_sheep_count, manual_cattle_count, manual_verified) VALUES (?, ?, ?, ?)`,
                [fileName, manual_sheep_count, manual_cattle_count, manual_verified || 1]
            );
        }
        db.close();
        res.json({ success: true });
    } catch (err) {
        db.close();
        res.status(500).json({ error: err.message });
    }
});

/**
 * 统计接口
 * GET /api/summary?taskId=xx 或 /api/summary?farmerId=xx
 * 返回 { sheep_total, cattle_total, pasture_area }
 */
router.get('/summary', (req, res) => {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('database/drone_detection.db');
    const { taskId, farmerId } = req.query;
    if (taskId) {
        // 主表统计，优先用manual_verified=1的manual字段，否则用sheep_count/cattle_count
        db.all(
            `SELECT sheep_count, cattle_count, manual_sheep_count, manual_cattle_count, manual_verified
             FROM count_results WHERE task_id = ?`, [taskId],
            (err, rows) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: err.message });
                }
                let sheep_total = 0, cattle_total = 0;
                rows.forEach(row => {
                    if (row.manual_verified === 1) {
                        sheep_total += row.manual_sheep_count || 0;
                        cattle_total += row.manual_cattle_count || 0;
                    } else {
                        sheep_total += row.sheep_count || 0;
                        cattle_total += row.cattle_count || 0;
                    }
                });
                // 查找草场面积和name
                db.get(
                    `SELECT f.pasture_area, f.name
                     FROM detection_tasks t
                     LEFT JOIN farmers f ON t.farmer_id = f.id
                     WHERE t.id = ?`, [taskId],
                    (err2, row2) => {
                        db.close();
                        if (err2) {
                            return res.status(500).json({ error: err2.message });
                        }
                        res.json({
                            sheep_total,
                            cattle_total,
                            pasture_area: row2 ? row2.pasture_area || 0 : 0,
                            name: row2 ? row2.name || '' : ''
                        });
                    }
                );
            }
        );
    } else if (farmerId) {
        // 临时表统计
        db.all(
            `SELECT sheep_count, cattle_count, manual_sheep_count, manual_cattle_count, manual_verified FROM temp_count_results`, [],
            (err, rows) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: err.message });
                }
                // 合计逻辑：优先用manual_verified=1的manual字段，否则用sheep_count/cattle_count
                let sheep_total = 0, cattle_total = 0;
                rows.forEach(row => {
                    if (row.manual_verified === 1) {
                        sheep_total += row.manual_sheep_count || 0;
                        cattle_total += row.manual_cattle_count || 0;
                    } else {
                        sheep_total += row.sheep_count || 0;
                        cattle_total += row.cattle_count || 0;
                    }
                });
                // 查找草场面积
                db.get(
                    `SELECT pasture_area FROM farmers WHERE id = ?`, [farmerId],
                    (err2, row2) => {
                        db.close();
                        if (err2) {
                            return res.status(500).json({ error: err2.message });
                        }
                        res.json({
                            sheep_total,
                            cattle_total,
                            pasture_area: row2 ? row2.pasture_area || 0 : 0
                        });
                    }
                );
            }
        );
    } else {
        db.close();
        res.status(400).json({ error: '缺少参数' });
    }
});

module.exports = router;
