/**
 * 设备检测服务
 * 处理无人机设备的检测和识别
 */

const fs = require('fs');
const path = require('path');
const { getDrives, getImagesFromFolder } = require('./fileService');
const { isFolderImported } = require('./importService');

/**
 * 检测包含DCIM文件夹的盘符
 */
function detectDriveWithDCIM() {
    const drives = getDrives();
    const dcimDrives = [];
    
    drives.forEach(drive => {
        try {
            // 检查盘符下是否有DCIM文件夹
            const dcimPath = path.join(drive, '\\DCIM');
            if (fs.existsSync(dcimPath)) {
                try {
                    // 计算DCIM文件夹下的总图片数量
                    let totalImageCount = 0;
                    const subFolders = [];
                    
                    const dcimContents = fs.readdirSync(dcimPath);
                    dcimContents.forEach(item => {
                        const itemPath = path.join(dcimPath, item);
                        try {
                            const stats = fs.statSync(itemPath);
                            if (stats.isDirectory()) {
                                const imageCount = getImagesFromFolder(itemPath).length;
                                totalImageCount += imageCount;
                                subFolders.push({
                                    name: item,
                                    path: itemPath,
                                    imageCount: imageCount,
                                    lastModified: stats.mtime.toLocaleString('zh-CN'),
                                    imported: isFolderImported(itemPath)
                                });
                            }
                        } catch (err) {
                            // 忽略无法访问的子文件夹
                        }
                    });
                    
                    // 获取盘符信息
                    let volumeLabel = '';
                    try {
                        // 尝试读取盘符标签（Windows）
                        const exec = require('child_process').execSync;
                        const result = exec(`vol ${drive}`, { encoding: 'utf8', timeout: 2000 });
                        const match = result.match(/Volume in drive .+ is (.+)/);
                        if (match && match[1]) {
                            volumeLabel = match[1].trim();
                        }
                    } catch (err) {
                        // 无法获取卷标签，使用默认名称
                    }
                    
                    dcimDrives.push({
                        drive: drive,
                        name: volumeLabel ? `${volumeLabel} (${drive})` : `(${drive})`,
                        path: dcimPath,
                        type: 'dcim_drive',
                        totalImageCount: totalImageCount,
                        subFolderCount: subFolders.length,
                        subFolders: subFolders.sort((a, b) => b.lastModified.localeCompare(a.lastModified)),
                        hasImages: totalImageCount > 0
                    });
                    
                    console.log(`检测到包含DCIM文件夹的盘符: ${drive} (${totalImageCount} 张图片)`);
                } catch (err) {
                    console.log(`检测到DCIM文件夹但无法读取详细信息: ${drive}`);
                    // 仍然添加到列表，但标记为无法访问
                    dcimDrives.push({
                        drive: drive,
                        name: `设备 (${drive}) - 无法访问`,
                        path: path.join(drive, '\\DCIM'),
                        type: 'dcim_drive',
                        totalImageCount: 0,
                        subFolderCount: 0,
                        subFolders: [],
                        hasImages: false,
                        accessible: false
                    });
                }
            }
        } catch (err) {
            // 忽略驱动器访问错误
        }
    });
    
    return dcimDrives;
}

/**
 * 保持原有函数名以兼容现有代码
 */
function detectDroneDevices() {
    return detectDriveWithDCIM();
}

/**
 * 获取指定驱动器的详细信息
 */
function getDriveDetails(driveLetter) {
    try {
        const dcimPath = path.join(driveLetter, '\\DCIM');
        if (!fs.existsSync(dcimPath)) {
            return null;
        }

        let totalImageCount = 0;
        const subFolders = [];
        
        const dcimContents = fs.readdirSync(dcimPath);
        dcimContents.forEach(item => {
            const itemPath = path.join(dcimPath, item);
            try {
                const stats = fs.statSync(itemPath);
                if (stats.isDirectory()) {
                    const imageCount = getImagesFromFolder(itemPath).length;
                    totalImageCount += imageCount;
                    subFolders.push({
                        name: item,
                        path: itemPath,
                        imageCount: imageCount,
                        lastModified: stats.mtime.toLocaleString('zh-CN'),
                        imported: isFolderImported(itemPath)
                    });
                }
            } catch (err) {
                // 忽略无法访问的子文件夹
            }
        });

        return {
            drive: driveLetter,
            path: dcimPath,
            totalImageCount,
            subFolders: subFolders.sort((a, b) => b.lastModified.localeCompare(a.lastModified))
        };
    } catch (error) {
        console.error(`获取驱动器详情失败: ${driveLetter}`, error);
        return null;
    }
}

/**
 * 检查设备是否可访问
 */
function isDeviceAccessible(driveLetter) {
    try {
        const dcimPath = path.join(driveLetter, '\\DCIM');
        fs.accessSync(dcimPath, fs.constants.R_OK);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    detectDriveWithDCIM,
    detectDroneDevices,
    getDriveDetails,
    isDeviceAccessible
};
