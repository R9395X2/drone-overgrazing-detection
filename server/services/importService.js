/**
 * 导入服务
 * 处理图片导入和历史记录管理
 */

const fs = require('fs');
const path = require('path');
const { 
    getImagesFromFolder, 
    getImageDate, 
    formatFileSize, 
    generateThumbnailPath,
    loadAppConfig,
    ensureImageLibraryExists,
    getImageLibraryPath 
} = require('./fileService');

// 导入历史文件路径
const IMPORT_HISTORY_FILE = 'import-history.json';

/**
 * 加载导入历史
 */
function loadImportHistory() {
    try {
        if (fs.existsSync(IMPORT_HISTORY_FILE)) {
            const data = fs.readFileSync(IMPORT_HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载导入历史失败:', error);
    }
    return { importedFolders: {}, lastUpdate: '' };
}

/**
 * 保存导入历史
 */
function saveImportHistory(history) {
    try {
        history.lastUpdate = new Date().toISOString();
        fs.writeFileSync(IMPORT_HISTORY_FILE, JSON.stringify(history, null, 2));
        return true;
    } catch (error) {
        console.error('保存导入历史失败:', error);
        return false;
    }
}

/**
 * 标记文件夹为已导入
 */
function markFolderAsImported(folderPath, copiedCount) {
    const history = loadImportHistory();
    history.importedFolders[folderPath] = {
        importedAt: new Date().toISOString(),
        imageCount: copiedCount || getImagesFromFolder(folderPath).length
    };
    return saveImportHistory(history);
}

/**
 * 检查文件夹是否已导入
 */
function isFolderImported(folderPath) {
    const history = loadImportHistory();
    return !!history.importedFolders[folderPath];
}

/**
 * 清除导入历史
 */
function clearImportHistory() {
    const emptyHistory = { importedFolders: {}, lastUpdate: '' };
    return saveImportHistory(emptyHistory);
}

/**
 * 创建临时文件夹
 * 返回创建的临时文件夹路径
 */
function createTempCheckFolder() {
    const config = loadAppConfig();
    const libraryPath = config.imageLibrary.path;
    const tempFolderName = 'temp_folder';
    const tempFolderPath = path.join(libraryPath, tempFolderName);

    if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath, { recursive: true });
    }
    // 每次都确保三个子文件夹存在
    ['original', 'result', 'thumb'].forEach(sub => {
        const subPath = path.join(tempFolderPath, sub);
        if (!fs.existsSync(subPath)) {
            fs.mkdirSync(subPath, { recursive: true });
        }
    });
    return tempFolderPath;
}

/**
 * 将临时文件夹重命名为正式文件夹
 * @param {string} tempFolderPath 临时文件夹路径
 * @param {string} checkId 盘点ID
 * @param {string} farmerId 农户ID
 * @param {string} farmerName 农户名
 * @param {string} date 日期字符串（如2025-06-21）
 * @returns {string} 正式文件夹路径
 */
function finalizeCheckFolder(tempFolderPath, checkId, farmerId, farmerName, date) {
    const config = loadAppConfig();
    const libraryPath = config.imageLibrary.path;
    // 农户名去除特殊字符
    const safeFarmerName = farmerName.replace(/[\\/:*?"<>|]/g, '_');
    const finalFolderName = `${checkId}_${farmerId}_${safeFarmerName}_${date}`;
    const finalFolderPath = path.join(libraryPath, finalFolderName);

    if (fs.existsSync(tempFolderPath)) {
        fs.renameSync(tempFolderPath, finalFolderPath);
        return finalFolderPath;
    } else {
        throw new Error('临时文件夹不存在');
    }
}

/**
 * 按时间分类复制文件到图像库（带进度支持）
 */
async function copyImagesToLibraryByDate(sourceFolder, folderName, progressCallback) {
    const config = loadAppConfig();
    const libraryPath = config.imageLibrary.path;
    
    if (!ensureImageLibraryExists()) {
        throw new Error('图像库目录不可用');
    }
    
    const sourceImages = getImagesFromFolder(sourceFolder);
    const copiedImages = [];
    let copiedCount = 0;
    let errorCount = 0;
    const totalFiles = sourceImages.length;
    
    // 按图片的拍摄时间分组
    const imagesByDate = {};
    
    for (let i = 0; i < sourceImages.length; i++) {
        const image = sourceImages[i];
        
        try {
            const imageDate = getImageDate(image.path);
            const dateKey = imageDate.toISOString().split('T')[0]; // YYYY-MM-DD格式
            
            if (!imagesByDate[dateKey]) {
                imagesByDate[dateKey] = [];
            }
            imagesByDate[dateKey].push(image);
            
            // 更新进度
            if (progressCallback) {
                progressCallback({
                    phase: 'analyzing',
                    current: i + 1,
                    total: totalFiles,
                    message: `正在分析图片时间信息... (${i + 1}/${totalFiles})`
                });
            }
            
            // 添加小延迟以便更新UI
            await new Promise(resolve => setTimeout(resolve, 10));
            
        } catch (error) {
            console.error(`分析图片失败 ${image.name}:`, error);
            errorCount++;
        }
    }
    
    // 开始复制文件
    let processedFiles = 0;
    
    for (const [dateKey, images] of Object.entries(imagesByDate)) {
        // 创建日期文件夹
        const dateFolderName = `${dateKey}_${folderName}`;
        const targetFolder = path.join(libraryPath, dateFolderName);
        
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }
        
        for (const image of images) {
            try {
                const sourceFile = image.path;
                const fileName = path.basename(sourceFile);
                let targetFile = path.join(targetFolder, fileName);
                
                // 处理文件名冲突
                if (fs.existsSync(targetFile)) {
                    if (config.import.conflictResolution === 'rename') {
                        const ext = path.extname(fileName);
                        const name = path.basename(fileName, ext);
                        let counter = 1;
                        
                        while (fs.existsSync(targetFile)) {
                            const newFileName = `${name}_${counter}${ext}`;
                            targetFile = path.join(targetFolder, newFileName);
                            counter++;
                        }
                    } else if (config.import.conflictResolution === 'skip') {
                        console.log(`跳过已存在的文件: ${fileName}`);
                        continue;
                    }
                }
                
                // 复制文件
                fs.copyFileSync(sourceFile, targetFile);
                
                // 获取新文件信息
                const stats = fs.statSync(targetFile);
                copiedImages.push({
                    name: path.basename(targetFile),
                    path: targetFile,
                    size: formatFileSize(stats.size),
                    sizeBytes: stats.size,
                    date: stats.mtime.toLocaleString('zh-CN'),
                    dateTime: stats.mtime.toISOString(),
                    processed: false,
                    thumbnail: generateThumbnailPath(targetFile),
                    dateFolder: dateFolderName
                });
                
                copiedCount++;
                processedFiles++;
                
                // 更新进度
                if (progressCallback) {
                    progressCallback({
                        phase: 'copying',
                        current: processedFiles,
                        total: totalFiles,
                        message: `正在复制文件... (${processedFiles}/${totalFiles})`
                    });
                }
                
                // 添加小延迟以便更新UI
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                console.error(`复制文件失败 ${image.name}:`, error);
                errorCount++;
                processedFiles++;
                
                // 更新进度（包括错误的文件）
                if (progressCallback) {
                    progressCallback({
                        phase: 'copying',
                        current: processedFiles,
                        total: totalFiles,
                        message: `正在复制文件... (${processedFiles}/${totalFiles})`
                    });
                }
            }
        }
    }
    
    // 完成进度
    if (progressCallback) {
        progressCallback({
            phase: 'completed',
            current: totalFiles,
            total: totalFiles,
            message: '导入完成！'
        });
    }
    
    return {
        targetFolder: libraryPath,
        images: copiedImages,
        copiedCount: copiedCount,
        errorCount: errorCount,
        totalCount: sourceImages.length,
        dateGroups: Object.keys(imagesByDate).length
    };
}

/**
 * 复制文件到图像库（旧版本，保持兼容性）
 */
async function copyImagesToLibrary(sourceFolder, folderName) {
    const config = loadAppConfig();
    const libraryPath = config.imageLibrary.path;
    
    if (!ensureImageLibraryExists()) {
        throw new Error('图像库目录不可用');
    }
    
    // 创建目标文件夹
    const targetFolder = path.join(libraryPath, folderName);
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
    }
    
    const sourceImages = getImagesFromFolder(sourceFolder);
    const copiedImages = [];
    let copiedCount = 0;
    let errorCount = 0;
    
    for (const image of sourceImages) {
        try {
            const sourceFile = image.path;
            const fileName = path.basename(sourceFile);
            let targetFile = path.join(targetFolder, fileName);
            
            // 处理文件名冲突
            if (fs.existsSync(targetFile)) {
                if (config.import.conflictResolution === 'rename') {
                    const ext = path.extname(fileName);
                    const name = path.basename(fileName, ext);
                    let counter = 1;
                    
                    while (fs.existsSync(targetFile)) {
                        const newFileName = `${name}_${counter}${ext}`;
                        targetFile = path.join(targetFolder, newFileName);
                        counter++;
                    }
                } else if (config.import.conflictResolution === 'skip') {
                    console.log(`跳过已存在的文件: ${fileName}`);
                    continue;
                }
            }
            
            // 复制文件
            fs.copyFileSync(sourceFile, targetFile);
            
            // 获取新文件信息
            const stats = fs.statSync(targetFile);
            copiedImages.push({
                name: path.basename(targetFile),
                path: targetFile,
                size: formatFileSize(stats.size),
                sizeBytes: stats.size,
                date: stats.mtime.toLocaleString('zh-CN'),
                dateTime: stats.mtime.toISOString(),
                processed: false,
                thumbnail: generateThumbnailPath(targetFile)
            });
            
            copiedCount++;
        } catch (error) {
            console.error(`复制文件失败 ${image.name}:`, error);
            errorCount++;
        }
    }
    
    return {
        targetFolder: targetFolder,
        images: copiedImages,
        copiedCount: copiedCount,
        errorCount: errorCount,
        totalCount: sourceImages.length
    };
}

module.exports = {
    loadImportHistory,
    saveImportHistory,
    markFolderAsImported,
    isFolderImported,
    clearImportHistory,
    copyImagesToLibraryByDate,
    copyImagesToLibrary,
    createTempCheckFolder,
    finalizeCheckFolder
};
