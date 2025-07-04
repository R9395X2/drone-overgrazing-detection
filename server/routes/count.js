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
let big_sheep_count = 0, small_sheep_count = 0, big_cattle_count = 0, small_cattle_count = 0;
// 只对当前图片赋值，不影响其它图片
if (animalType === 'sheep') {
    big_sheep_count = count;
} else if (animalType === 'cattle') {
    big_cattle_count = count;
} else if (animalType === 'both') {
    big_sheep_count = count;
    big_cattle_count = count;
}
db.run(
    `INSERT OR REPLACE INTO temp_count_results (file_name, file_path, algorithm_name, big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))`,
    [file_name, file_path, 'NKY', big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, 'completed', null]
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
        // 删除result目录下对应图片的相关文件
        const imgName = path.basename(imgPath);
        const imgBase = imgName.replace(/\.[^.]+$/, '');
        const resultDir = path.join(outputDir, 'result');
        const exts = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'];
        // 删除图片文件
        exts.forEach(ext => {
            const imgFile = path.join(resultDir, imgBase + ext);
            if (fs.existsSync(imgFile)) {
                try { fs.unlinkSync(imgFile); } catch (e) {}
            }
        });
        // 删除txt文件
        const txtFile = path.join(resultDir, imgBase + '.txt');
        if (fs.existsSync(txtFile)) {
            try { fs.unlinkSync(txtFile); } catch (e) {}
        }
        // 删除labels下的txt文件
        const labelFile = path.join(resultDir, 'labels', imgBase + '.txt');
        if (fs.existsSync(labelFile)) {
            try { fs.unlinkSync(labelFile); } catch (e) {}
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
            let big_sheep_count = 0, small_sheep_count = 0, big_cattle_count = 0, small_cattle_count = 0;
            if (animalType === 'sheep') {
                big_sheep_count = count;
            } else if (animalType === 'cattle') {
                big_cattle_count = count;
            } else if (animalType === 'both') {
                big_sheep_count = count;
                big_cattle_count = count;
            }
            const db = new sqlite3.Database('database/drone_detection.db');
            db.run(
                `INSERT OR REPLACE INTO temp_count_results (file_name, file_path, algorithm_name, big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, status, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))`,
                [file_name, file_path, 'NKY', big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, 'completed', null],
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
            let big_sheep_count = 0, small_sheep_count = 0, big_cattle_count = 0, small_cattle_count = 0;
            if (animalType === 'sheep') {
                big_sheep_count = count;
            } else if (animalType === 'cattle') {
                big_cattle_count = count;
            } else if (animalType === 'both') {
                big_sheep_count = count;
                big_cattle_count = count;
            }
            const db = new sqlite3.Database('database/drone_detection.db');
            db.run(
                `INSERT OR REPLACE INTO temp_count_results (file_name, file_path, algorithm_name, big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, status, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))`,
                [file_name, file_path, 'NKY', big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, 'completed', null],
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
        const sql = `SELECT big_cattle_count, small_cattle_count, big_sheep_count, small_sheep_count, status,
            manual_big_cattle_count, manual_small_cattle_count, manual_big_sheep_count, manual_small_sheep_count, manual_verified
            FROM temp_count_results WHERE file_name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1`;
        db.get(sql, [fileName], (err, row) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.json({
                    big_cattle_count: null,
                    small_cattle_count: null,
                    big_sheep_count: null,
                    small_sheep_count: null,
                    status: null,
                    manual_big_cattle_count: null,
                    manual_small_cattle_count: null,
                    manual_big_sheep_count: null,
                    manual_small_sheep_count: null,
                    manual_verified: 0
                });
            }
            res.json({
                big_cattle_count: row.big_cattle_count || 0,
                small_cattle_count: row.small_cattle_count || 0,
                big_sheep_count: row.big_sheep_count || 0,
                small_sheep_count: row.small_sheep_count || 0,
                status: row.status,
                manual_big_cattle_count: row.manual_big_cattle_count || 0,
                manual_small_cattle_count: row.manual_small_cattle_count || 0,
                manual_big_sheep_count: row.manual_big_sheep_count || 0,
                manual_small_sheep_count: row.manual_small_sheep_count || 0,
                manual_verified: row.manual_verified || 0
            });
        });
    } else if (taskId) {
        // 正式盘点，查 count_results
        const sql = 'SELECT big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, status, manual_big_sheep_count, manual_small_sheep_count, manual_big_cattle_count, manual_small_cattle_count, manual_verified FROM count_results WHERE task_id = ? AND file_name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1';
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
                sheep = (row.manual_big_sheep_count || 0) + (row.manual_small_sheep_count || 0);
                cattle = (row.manual_big_cattle_count || 0) + (row.manual_small_cattle_count || 0);
            } else {
                sheep = (row.big_sheep_count || 0) + (row.small_sheep_count || 0);
                cattle = (row.big_cattle_count || 0) + (row.small_cattle_count || 0);
            }
            res.json({ sheep_count: sheep, cattle_count: cattle, status: row.status });
        });
    } else {
        // 默认查 count_results，取最新一条
        const sql = 'SELECT big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, status FROM count_results WHERE file_name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1';
        db.get(sql, [fileName], (err, row) => {
            db.close();
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.json({ sheep_count: null, cattle_count: null, status: null });
            }
            const sheep_count = (row.big_sheep_count || 0) + (row.small_sheep_count || 0);
            const cattle_count = (row.big_cattle_count || 0) + (row.small_cattle_count || 0);
            res.json({ sheep_count, cattle_count, status: row.status });
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
        // 删除result目录下全部内容
        const resultDir = path.join(outputDir, 'result');
        if (fs.existsSync(resultDir)) {
            try {
                fs.rmSync(resultDir, { recursive: true, force: true });
            } catch (e) {}
        }
        // 重新创建result目录，防止后续流程出错
        try {
            fs.mkdirSync(resultDir, { recursive: true });
        } catch (e) {}

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
                            (task_id, file_name, file_path, algorithm_name, big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, status, manual_big_cattle_count, manual_small_cattle_count, manual_big_sheep_count, manual_small_sheep_count, manual_verified, notes, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))`
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
                                row.big_sheep_count || 0,
                                row.small_sheep_count || 0,
                                row.big_cattle_count || 0,
                                row.small_cattle_count || 0,
                                row.status,
                                row.manual_big_cattle_count || 0,
                                row.manual_small_cattle_count || 0,
                                row.manual_big_sheep_count || 0,
                                row.manual_small_sheep_count || 0,
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
    const { fileName, big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count } = req.body;
    if (
        !fileName ||
        typeof big_sheep_count !== 'number' ||
        typeof small_sheep_count !== 'number' ||
        typeof big_cattle_count !== 'number' ||
        typeof small_cattle_count !== 'number'
    ) {
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
            `UPDATE temp_count_results SET big_sheep_count=?, small_sheep_count=?, big_cattle_count=?, small_cattle_count=?, status='completed' WHERE file_name=? COLLATE NOCASE`,
            [big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, fileName]
        );
        // 如果没有记录被更新，则插入
        if (result.changes === 0) {
            await runAsync(
                `INSERT OR REPLACE INTO temp_count_results (file_name, big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, status) VALUES (?, ?, ?, ?, ?, 'completed')`,
                [fileName, big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count]
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
 * body: { fileName, manual_big_cattle_count, manual_small_cattle_count, manual_big_sheep_count, manual_small_sheep_count, manual_verified, farmer_id }
 */
router.post('/manual-correct', async (req, res) => {
    const {
        fileName,
        manual_big_cattle_count,
        manual_small_cattle_count,
        manual_big_sheep_count,
        manual_small_sheep_count,
        manual_verified
    } = req.body;
    if (
        !fileName ||
        typeof manual_big_cattle_count !== 'number' ||
        typeof manual_small_cattle_count !== 'number' ||
        typeof manual_big_sheep_count !== 'number' ||
        typeof manual_small_sheep_count !== 'number'
    ) {
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
            `UPDATE temp_count_results SET manual_big_cattle_count=?, manual_small_cattle_count=?, manual_big_sheep_count=?, manual_small_sheep_count=?, manual_verified=? WHERE file_name=? COLLATE NOCASE`,
            [manual_big_cattle_count, manual_small_cattle_count, manual_big_sheep_count, manual_small_sheep_count, manual_verified || 1, fileName]
        );
        // 如果没有记录被更新，则插入
        if (result.changes === 0) {
            await runAsync(
                `INSERT OR REPLACE INTO temp_count_results (file_name, manual_big_cattle_count, manual_small_cattle_count, manual_big_sheep_count, manual_small_sheep_count, manual_verified) VALUES (?, ?, ?, ?, ?, ?)`,
                [fileName, manual_big_cattle_count, manual_small_cattle_count, manual_big_sheep_count, manual_small_sheep_count, manual_verified || 1]
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
            `SELECT big_sheep_count, small_sheep_count, big_cattle_count, small_cattle_count, manual_big_sheep_count, manual_small_sheep_count, manual_big_cattle_count, manual_small_cattle_count, manual_verified
             FROM count_results WHERE task_id = ?`, [taskId],
            (err, rows) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: err.message });
                }
                let sheep_total = 0, cattle_total = 0;
                let big_cattle_total = 0, small_cattle_total = 0, big_sheep_total = 0, small_sheep_total = 0;
                rows.forEach(row => {
                    if (row.manual_verified === 1) {
                        big_sheep_total += row.manual_big_sheep_count || 0;
                        small_sheep_total += row.manual_small_sheep_count || 0;
                        big_cattle_total += row.manual_big_cattle_count || 0;
                        small_cattle_total += row.manual_small_cattle_count || 0;
                    } else {
                        big_sheep_total += row.big_sheep_count || 0;
                        small_sheep_total += row.small_sheep_count || 0;
                        big_cattle_total += row.big_cattle_count || 0;
                        small_cattle_total += row.small_cattle_count || 0;
                    }
                });
                sheep_total = big_sheep_total + small_sheep_total;
                cattle_total = big_cattle_total + small_cattle_total;
                // 查找草场面积和name
db.get(
                    `SELECT f.pasture_area, f.fodder_area, f.overload, f.name
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
                            big_cattle_total,
                            small_cattle_total,
                            big_sheep_total,
                            small_sheep_total,
                            pasture_area: row2 ? row2.pasture_area || 0 : 0,
                            fodder_area: row2 ? row2.fodder_area || 0 : 0,
                            overload: row2 && row2.overload !== undefined ? row2.overload : '-',
                            name: row2 ? row2.name || '' : ''
                        });
                    }
                );
            }
        );
    } else if (farmerId) {
        // 临时表统计
        db.all(
            `SELECT big_cattle_count, small_cattle_count, big_sheep_count, small_sheep_count,
                manual_big_cattle_count, manual_small_cattle_count, manual_big_sheep_count, manual_small_sheep_count, manual_verified
             FROM temp_count_results`, [],
            (err, rows) => {
                if (err) {
                    db.close();
                    return res.status(500).json({ error: err.message });
                }
                // 合计逻辑：优先用manual_verified=1的manual字段，否则用普通字段
                let big_cattle_total = 0, small_cattle_total = 0, big_sheep_total = 0, small_sheep_total = 0;
                if (rows && rows.length > 0) {
                    rows.forEach(row => {
                        if (row.manual_verified === 1) {
                            big_cattle_total += row.manual_big_cattle_count || 0;
                            small_cattle_total += row.manual_small_cattle_count || 0;
                            big_sheep_total += row.manual_big_sheep_count || 0;
                            small_sheep_total += row.manual_small_sheep_count || 0;
                        } else {
                            big_cattle_total += row.big_cattle_count || 0;
                            small_cattle_total += row.small_cattle_count || 0;
                            big_sheep_total += row.big_sheep_count || 0;
                            small_sheep_total += row.small_sheep_count || 0;
                        }
                    });
                }
                const sheep_total = big_sheep_total + small_sheep_total;
                const cattle_total = big_cattle_total + small_cattle_total;
                // 查找草场面积
db.close();
res.json({
    sheep_total,
    cattle_total,
    big_cattle_total,
    small_cattle_total,
    big_sheep_total,
    small_sheep_total
});
            }
        );
    } else {
        db.close();
        res.status(400).json({ error: '缺少参数' });
    }
});

/**
 * 读取labels标注内容
 * GET /api/count/label?fileName=xxx.jpg
 * 返回txt内容
 */
router.get('/label', (req, res) => {
    const { fileName } = req.query;
    if (!fileName) {
        return res.status(400).json({ error: '缺少fileName参数' });
    }
    // 假设labels路径为MediaGallery/temp_folder/result/labels/xxx.txt
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const labelPath = path.join('MediaGallery', 'temp_folder', 'result', 'labels', baseName + '.txt');
    if (!fs.existsSync(labelPath)) {
        return res.status(404).json({ error: '标注文件不存在' });
    }
    try {
        const content = fs.readFileSync(labelPath, 'utf-8');
        res.type('text/plain').send(content);
    } catch (e) {
        res.status(500).json({ error: '读取标注文件失败', detail: e.message });
    }
});

/**
 * 保存labels标注内容
 * POST /api/count/label?fileName=xxx.jpg
 * body: txt内容
 */
router.post('/label', (req, res) => {
    const { fileName } = req.query;
    if (!fileName) {
        return res.status(400).json({ error: '缺少fileName参数' });
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        const baseName = fileName.replace(/\.[^.]+$/, '');
        const labelDir = path.join('MediaGallery', 'temp_folder', 'result', 'labels');
        const labelPath = path.join(labelDir, baseName + '.txt');
        try {
            // 确保labels目录存在
            if (!fs.existsSync(labelDir)) {
                fs.mkdirSync(labelDir, { recursive: true });
            }
            fs.writeFileSync(labelPath, body, 'utf-8');
            // 统计各类数量并写入manual_xxx字段
            try {
                // 解析标注内容
                let manual_big_sheep_count = 0, manual_small_sheep_count = 0, manual_big_cattle_count = 0, manual_small_cattle_count = 0;
                const lines = body.trim().split('\n');
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 9) {
                        const classId = parseInt(parts[0]);
                        if (classId === 0) manual_big_sheep_count++;
                        else if (classId === 1) manual_small_sheep_count++;
                        else if (classId === 2) manual_big_cattle_count++;
                        else if (classId === 3) manual_small_cattle_count++;
                    }
                }
                const sqlite3 = require('sqlite3').verbose();
                const db = new sqlite3.Database('database/drone_detection.db');
                db.run(
                    `UPDATE temp_count_results SET manual_big_sheep_count=?, manual_small_sheep_count=?, manual_big_cattle_count=?, manual_small_cattle_count=?, manual_verified=1 WHERE file_name=? COLLATE NOCASE`,
                    [manual_big_sheep_count, manual_small_sheep_count, manual_big_cattle_count, manual_small_cattle_count, fileName],
                    function(err) {
                        db.close();
                        if (err) {
                            res.status(500).json({ error: '保存标注文件成功但写入数据库失败', detail: err.message });
                        } else {
                            res.json({ success: true });
                        }
                    }
                );
            } catch (e2) {
                res.status(500).json({ error: '保存标注文件成功但统计数量或写入数据库失败', detail: e2.message });
            }
        } catch (e) {
            res.status(500).json({ error: '保存标注文件失败', detail: e.message });
        }
    });
});

/**
 * 生成结果图片
 * POST /api/count/generate-result-image
 * body: { fileName }
 */
router.post('/generate-result-image', async (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) {
            return res.status(400).json({ error: '缺少fileName参数' });
        }

        // 读取媒体库根目录
        const configPath = path.join(__dirname, '../../config/app.config.json');
        let mediaRoot = path.resolve('MediaGallery');
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.imageLibrary && config.imageLibrary.path) {
                mediaRoot = config.imageLibrary.path;
            }
        } catch (e) {
            // 读取失败则用默认
        }

        const baseName = fileName.replace(/\.[^.]+$/, '');
        const imageRelPath = path.join('temp_folder', 'original', fileName);
        const labelRelPath = path.join('temp_folder', 'result', 'labels', baseName + '.txt');
        const outputRelPath = path.join('temp_folder', 'result', baseName + '.jpg');
        const originalImagePath = path.join(mediaRoot, imageRelPath);
        const labelPath = path.join(mediaRoot, labelRelPath);
        const outputImagePath = path.join(mediaRoot, outputRelPath);

        // 检查原图是否存在
        if (!fs.existsSync(originalImagePath)) {
            return res.status(404).json({ error: '原图文件不存在' });
        }

        // 检查标注文件是否存在
        if (!fs.existsSync(labelPath)) {
            return res.status(404).json({ error: '标注文件不存在' });
        }

        // 调用Python脚本生成结果图（传递媒体库根目录和相对路径）
        const pyCmd = `D:/bao/env/conda/Library/bin/conda.bat activate numsheep && python -W ignore D:/drone-overgrazing-detection/scripts/generate_result_image.py --media_root "${mediaRoot}" --image_relpath "${imageRelPath}" --label_relpath "${labelRelPath}" --output_relpath "${outputRelPath}"`;

        exec(pyCmd, { shell: true }, (error, stdout, stderr) => {
            if (error) {
                console.error('生成结果图失败:', error);
                return res.status(500).json({ error: '生成结果图失败', detail: error.message });
            }

            // 检查输出图片是否生成成功
            if (fs.existsSync(outputImagePath)) {
                const resultImageUrl = '/' + path.relative(path.resolve('./'), outputImagePath).replace(/\\/g, '/');
                res.json({ 
                    success: true, 
                    resultImageUrl,
                    stdout,
                    stderr 
                });
            } else {
                res.status(500).json({ error: '结果图生成失败，输出文件不存在' });
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 批量设置labels首数字为羊或牛
 * POST /api/count/batch-set-labels
 * body: { type: "sheep" | "cattle" }
 */
router.post('/batch-set-labels', async (req, res) => {
    const { type } = req.body;
    if (!['sheep', 'cattle'].includes(type)) {
        return res.status(400).json({ error: 'type参数错误' });
    }
    const fs = require('fs');
    const path = require('path');
    const sqlite3 = require('sqlite3').verbose();
    const labelDir = path.join('MediaGallery', 'temp_folder', 'result', 'labels');
    if (!fs.existsSync(labelDir)) return res.status(404).json({ error: 'labels目录不存在' });
    const files = fs.readdirSync(labelDir).filter(f => f.endsWith('.txt'));
    let changed = 0;
    for (const file of files) {
        const filePath = path.join(labelDir, file);
        let lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        let manual_big_sheep_count = 0, manual_small_sheep_count = 0, manual_big_cattle_count = 0, manual_small_cattle_count = 0;
        lines = lines.map(line => {
            let parts = line.trim().split(/\s+/);
            if (parts.length >= 9) {
                let orig = parts[0];
                if (type === 'sheep') {
                    // 2→0, 3→1, 0/1不变
                    if (orig === '2') parts[0] = '0';
                    else if (orig === '3') parts[0] = '1';
                } else {
                    // 0→2, 1→3, 2/3不变
                    if (orig === '0') parts[0] = '2';
                    else if (orig === '1') parts[0] = '3';
                }
                // 统计
                if (parts[0] === '0') manual_big_sheep_count++;
                else if (parts[0] === '1') manual_small_sheep_count++;
                else if (parts[0] === '2') manual_big_cattle_count++;
                else if (parts[0] === '3') manual_small_cattle_count++;
                return parts.join(' ');
            }
            return line;
        });
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        // 更新数据库
        const db = new sqlite3.Database('database/drone_detection.db');
        db.run(
            `UPDATE temp_count_results SET manual_big_sheep_count=?, manual_small_sheep_count=?, manual_big_cattle_count=?, manual_small_cattle_count=?, manual_verified=1 WHERE file_name=? COLLATE NOCASE`,
            [manual_big_sheep_count, manual_small_sheep_count, manual_big_cattle_count, manual_small_cattle_count, file.replace(/\.txt$/i, '.jpg')],
            function(err) {
                db.close();
            }
        );
        changed++;
    }
    res.json({ success: true, changed });
});

module.exports = router;
