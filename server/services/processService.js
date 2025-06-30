/**
 * 图像处理服务
 * 处理Python脚本调用和图像处理
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const configManager = require('../../config/ConfigManager');

/**
 * 调用配置的Python脚本处理图片
 */
async function processImageWithScripts(imagePath, selectedScripts) {
    const enabledScripts = configManager.getEnabledScripts();
    const results = [];
    
    for (const script of enabledScripts) {
        if (selectedScripts && !selectedScripts.includes(script.id)) {
            continue; // 跳过未选择的脚本
        }
        
        try {
            console.log(`🐍 执行脚本: ${script.name}`);
            const result = await processPythonScript(script, imagePath);
            results.push({
                scriptId: script.id,
                scriptName: script.name,
                success: true,
                data: result
            });
        } catch (error) {
            console.error(`❌ 脚本执行失败 [${script.name}]:`, error);
            results.push({
                scriptId: script.id,
                scriptName: script.name,
                success: false,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * 调用Python脚本处理图片（真实实现）
 */
function processPythonScript(scriptConfig, imagePath) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(scriptConfig.path);
        
        if (!fs.existsSync(scriptPath)) {
            reject(new Error(`脚本文件不存在: ${scriptPath}`));
            return;
        }
        
        // 准备脚本参数 - 使用脚本适配器的调用方式
        let args = [];
        
        if (scriptConfig.options && scriptConfig.options.script_type) {
            // 使用脚本适配器
            args = [scriptPath, scriptConfig.options.script_type, imagePath];
            
            // 添加其他选项（除了script_type）
            const otherOptions = { ...scriptConfig.options };
            delete otherOptions.script_type;
            if (Object.keys(otherOptions).length > 0) {
                args.push(JSON.stringify(otherOptions));
            }
        } else {
            // 传统方式
            args = [scriptPath, imagePath];
            if (scriptConfig.options) {
                args.push(JSON.stringify(scriptConfig.options));
            }
        }
        
        console.log(`执行命令: python ${args.join(' ')}`);
        
        const pythonProcess = spawn('python', args);
        let output = '';
        let error = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    // 尝试解析JSON输出
                    const result = JSON.parse(output);
                    resolve(result);
                } catch (parseError) {
                    // 如果不是JSON，返回原始输出
                    resolve({
                        type: 'text',
                        content: output.trim(),
                        raw: true
                    });
                }
            } else {
                reject(new Error(`Python脚本执行失败 (退出码: ${code}): ${error}`));
            }
        });
        
        pythonProcess.on('error', (err) => {
            reject(new Error(`无法启动Python进程: ${err.message}`));
        });
    });
}

/**
 * 验证图片文件是否存在且可访问
 */
function validateImageFile(imagePath) {
    if (!imagePath) {
        throw new Error('图片路径不能为空');
    }
    
    if (!fs.existsSync(imagePath)) {
        throw new Error('图片文件不存在');
    }
    
    try {
        fs.accessSync(imagePath, fs.constants.R_OK);
    } catch (error) {
        throw new Error('无法读取图片文件');
    }
    
    return true;
}

/**
 * 生成处理结果摘要
 */
function generateProcessingSummary(scriptResults, processingTime) {
    const summary = {
        totalScripts: scriptResults.length,
        successfulScripts: scriptResults.filter(r => r.success).length,
        failedScripts: scriptResults.filter(r => !r.success).length,
        processingTime: processingTime,
        hasErrors: scriptResults.some(r => !r.success)
    };
    
    // 提取主要结果
    const mainResults = {};
    scriptResults.forEach(result => {
        if (result.success && result.data) {
            // 检测羊群数量结果
            if (result.data.results && typeof result.data.results.sheep_count === 'number') {
                mainResults.sheepCount = result.data.results.sheep_count;
                mainResults.processedImage = result.data.results.processed_image;
                mainResults.resultsDirectory = result.data.results.results_directory;
            }
            
            // 其他类型的结果
            if (result.data.type) {
                mainResults[result.data.type] = result.data.content || result.data;
            }
        }
    });
    
    summary.mainResults = mainResults;
    return summary;
}

/**
 * 清理处理结果文件（可选）
 */
function cleanupProcessingResults(resultPaths) {
    if (!Array.isArray(resultPaths)) {
        return;
    }
    
    resultPaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`清理临时文件: ${filePath}`);
            }
        } catch (error) {
            console.warn(`清理文件失败: ${filePath}`, error.message);
        }
    });
}

module.exports = {
    processImageWithScripts,
    processPythonScript,
    validateImageFile,
    generateProcessingSummary,
    cleanupProcessingResults
};
