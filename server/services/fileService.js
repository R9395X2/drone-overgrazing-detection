/**
 * 文件系统服务
 * 处理文件和目录相关操作
 */

const fs = require('fs');
const path = require('path');

// 应用配置文件路径
const APP_CONFIG_FILE = 'config/app.config.json';

// 支持的图片格式
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'];

/**
 * 加载应用配置
 */
function loadAppConfig() {
    try {
        if (fs.existsSync(APP_CONFIG_FILE)) {
            const data = fs.readFileSync(APP_CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('加载应用配置失败:', error);
    }
    
    // 返回默认配置
    return {
        imageLibrary: {
            path: 'D:\\CYWRJGDFMJCXT',
            autoCreate: true,
            copyOriginals: true,
            classifyByDate: true
        },
        ui: {
            autoLoadDirectory: true,
            defaultView: 'grid',
            theme: 'default'
        },
        import: {
            preserveStructure: true,
            addTimestamp: false,
            conflictResolution: 'rename'
        }
    };
}

/**
 * 保存应用配置
 */
function saveAppConfig(config) {
    try {
        fs.writeFileSync(APP_CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('保存应用配置失败:', error);
        return false;
    }
}

/**
 * 获取图像库路径
 */
function getImageLibraryPath() {
    const config = loadAppConfig();
    return config.imageLibrary.path;
}

/**
 * 确保图像库目录存在
 */
function ensureImageLibraryExists() {
    const config = loadAppConfig();
    const libraryPath = config.imageLibrary.path;
    
    if (!fs.existsSync(libraryPath)) {
        if (config.imageLibrary.autoCreate) {
            try {
                fs.mkdirSync(libraryPath, { recursive: true });
                console.log(`✅ 图像库目录已创建: ${libraryPath}`);
                return true;
            } catch (error) {
                console.error('创建图像库目录失败:', error);
                return false;
            }
        } else {
            console.warn(`⚠️ 图像库目录不存在: ${libraryPath}`);
            return false;
        }
    }
    return true;
}

/**
 * 检查是否为图片文件
 */
function isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return SUPPORTED_FORMATS.includes(ext);
}

/**
 * 获取文件夹中的图片
 */
function getImagesFromFolder(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        const images = [];
        // 计算folder字段：thumb/original/result的父目录
        const parentDir = path.dirname(folderPath);
        // 调试输出
        console.log('[getImagesFromFolder] folderPath:', folderPath, 'parentDir:', parentDir);
        // 取/MediaGallery/xxx_xxx_xxx
        const parentNorm = parentDir.replace(/\\/g, '/');
        let folderWebPath = '';
        const galleryIdx = parentNorm.indexOf('MediaGallery/');
        if (galleryIdx !== -1) {
            folderWebPath = '/' + parentNorm.substring(galleryIdx);
        }
        console.log('[getImagesFromFolder] folderWebPath:', folderWebPath);
        files.forEach(file => {
            if (isImageFile(file)) {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                images.push({
                    name: file,
                    path: filePath,
                    size: formatFileSize(stats.size),
                    sizeBytes: stats.size,
                    date: stats.mtime.toLocaleString('zh-CN'),
                    dateTime: stats.mtime.toISOString(),
                    processed: false,
                    thumbnail: generateThumbnailPath(filePath),
                    folder: folderWebPath
                });
            }
        });
        return images;
    } catch (error) {
        console.error('读取文件夹失败:', error);
        return [];
    }
}

/**
 * 递归获取所有图片
 */
function getAllImagesFromDirectory(dirPath, baseLibraryPath = null) {
    let allImages = [];
    try {
        const items = fs.readdirSync(dirPath);
        items.forEach(item => {
            const itemPath = path.join(dirPath, item);
            const stats = fs.statSync(itemPath);
            // 跳过任何名为result的目录
            if (stats.isDirectory() && item.toLowerCase() !== 'result') {
                allImages = allImages.concat(getAllImagesFromDirectory(itemPath, baseLibraryPath));
            } else if (isImageFile(item)) {
                const folderName = baseLibraryPath ? 
                    path.relative(baseLibraryPath, path.dirname(itemPath)) : '';
                // 判断同级目录下是否有result文件夹且有同名（不考虑后缀）图片
                let processed = false;
                try {
                    const parentDir = path.dirname(itemPath);
                    const resultDir = path.join(parentDir, 'result');
                    if (fs.existsSync(resultDir)) {
                        const baseName = path.basename(item, path.extname(item)).toLowerCase();
                        const resultFiles = fs.readdirSync(resultDir)
                            .filter(f => isImageFile(f))
                            .map(f => path.basename(f, path.extname(f)).toLowerCase());
                        if (resultFiles.includes(baseName)) {
                            processed = true;
                        }
                    }
                } catch (e) {}
                allImages.push({
                    name: item,
                    path: itemPath,
                    size: formatFileSize(stats.size),
                    sizeBytes: stats.size,
                    date: stats.mtime.toLocaleString('zh-CN'),
                    dateTime: stats.mtime.toISOString(),
                    processed: processed,
                    thumbnail: generateThumbnailPath(itemPath),
                    folder: folderName
                });
            }
        });
    } catch (error) {
        console.error(`读取目录失败: ${dirPath}`, error);
    }
    return allImages;
}

/**
 * 获取图片的创建时间或修改时间
 */
function getImageDate(imagePath) {
    try {
        const stats = fs.statSync(imagePath);
        // 优先使用birthtimeMs（创建时间），如果不可用则使用mtimeMs（修改时间）
        const timestamp = stats.birthtimeMs || stats.mtimeMs;
        return new Date(timestamp);
    } catch (error) {
        console.error(`获取图片时间失败: ${imagePath}`, error);
        return new Date(); // 返回当前时间作为备选
    }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0M';
    const m = 1024 * 1024;
    return (bytes / m).toFixed(1).replace(/\.0$/, '') + 'M';
}

/**
 * 生成缩略图路径
 */
function generateThumbnailPath(imagePath) {
    // 这里应该生成实际的缩略图，暂时返回原图路径
    return `/api/thumbnail?path=${encodeURIComponent(imagePath)}`;
}

/**
 * 获取驱动器列表 (Windows)
 */
function getDrives() {
    const drives = [];
    for (let i = 65; i <= 90; i++) {
        const drive = String.fromCharCode(i) + ':';
        try {
            fs.accessSync(drive + '\\', fs.constants.F_OK);
            drives.push(drive);
        } catch (err) {
            // 驱动器不存在，跳过
        }
    }
    return drives;
}

module.exports = {
    loadAppConfig,
    saveAppConfig,
    getImageLibraryPath,
    ensureImageLibraryExists,
    isImageFile,
    getImagesFromFolder,
    getAllImagesFromDirectory,
    getImageDate,
    formatFileSize,
    generateThumbnailPath,
    getDrives,
    SUPPORTED_FORMATS
};
