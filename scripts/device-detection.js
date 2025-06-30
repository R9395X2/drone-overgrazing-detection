// 设备检测模块
class DeviceDetection {
    constructor() {
        this.lastDetectedDevices = [];
    }

    async autoDetect() {
        try {
            LoadingManager.show();
            const autoDetectBtn = document.getElementById('autoDetectBtn');
            autoDetectBtn.disabled = true;
            autoDetectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检测中...';
            
            const response = await fetch('/api/detect-devices', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.lastDetectedDevices = data.devices;
                window.lastDetectedDevices = data.devices; // 保持向后兼容
                
                if (data.devices && data.devices.length > 0) {
                    this.showDeviceSelectionDialog(data.devices);
                } else {
                    NotificationManager.show('未检测到无人机设备', 'warning');
                }
            } else {
                NotificationManager.show('设备检测失败', 'error');
            }
        } catch (error) {
            console.error('设备检测失败:', error);
            NotificationManager.show('设备检测失败', 'error');
        } finally {
            LoadingManager.hide();
            const autoDetectBtn = document.getElementById('autoDetectBtn');
            autoDetectBtn.disabled = false;
            autoDetectBtn.innerHTML = '<i class="fas fa-usb"></i> 自动检测设备';
        }
    }

    showDeviceSelectionDialog(devices) {
        if (!devices || devices.length === 0) {
        const dialogHTML = `
            <div class="device-selection-dialog enhanced">
                <div class="dialog-header">
                    <h3><i class="fas fa-hdd"></i>选择盘符</h3>
                </div>
                <div class="device-list enhanced">
                    ${deviceList}
                </div>
                <div class="dialog-footer" style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-end;">
                    <button onclick="DialogManager.close()" class="btn btn-secondary">关闭</button>
                    <button onclick="deviceDetection.clearImportHistory()" class="btn btn-sm btn-secondary" title="清除导入历史">
                        <i class="fas fa-trash"></i> 清除历史
                    </button>
                    <button onclick="(function(){DialogManager.close(); setTimeout(()=>deviceDetection.autoDetect(), 350);})()" class="btn btn-secondary">
                        <i class="fas fa-refresh"></i> 重新检测
                    </button>
                </div>
            </div>
        `;
        
        DialogManager.show(dialogHTML);
            return;
        }

        let deviceList = '';
        
        devices.forEach(device => {
            const isAccessible = device.accessible !== false;
            const deviceClass = !isAccessible ? 'device-item inaccessible' : 'device-item';
            
            deviceList += `
                <div class="${deviceClass}" onclick="${isAccessible ? `deviceDetection.showDriveSubfolders('${device.drive}', '${device.name.replace(/'/g, "\\'")}', ${device.totalImageCount}, ${JSON.stringify(device.subFolders).replace(/"/g, '&quot;')})` : ''}">
                    <div class="device-icon">
                        <i class="fas ${isAccessible ? 'fa-hdd' : 'fa-exclamation-triangle'}"></i>
                    </div>
                    <div class="device-info">
                        <div class="device-details">
                            <span class="device-path">${device.drive}\\DCIM</span>
                            ${isAccessible ? `
                                <span class="device-stats">
                                    ${device.totalImageCount} 张图片 · ${device.subFolderCount} 个文件夹
                                </span>
                            ` : `
                                <span class="device-error">无法访问</span>
                            `}
                        </div>
                    </div>
                    <div class="device-action">
                        ${isAccessible ? `
                            <span class="select-badge">
                                <i class="fas fa-chevron-right"></i> 选择文件夹
                            </span>
                        ` : `
                            <span class="error-badge">
                                <i class="fas fa-times"></i> 无法访问
                            </span>
                        `}
                    </div>
                </div>
            `;
        });
        
        const dialogHTML = `
            <div class="device-selection-dialog enhanced">
                <div class="dialog-header">
                    <h3><i class="fas fa-hdd"></i>选择盘符</h3>
                </div>
                <div class="device-list enhanced">
                    ${deviceList}
                </div>
                <div class="dialog-footer" style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-end;">
                    <button onclick="DialogManager.close(); setTimeout(() => deviceDetection.autoDetect(), 350);" class="btn btn-secondary">
                        <i class="fas fa-refresh"></i> 重新检测
                    </button>
                    <button onclick="deviceDetection.clearImportHistory()" class="btn btn-sm btn-secondary" title="清除导入历史" style="margin-left:auto;">
                        <i class="fas fa-trash"></i> 清除历史
                    </button>
                    <button onclick="DialogManager.close()" class="btn btn-secondary">
                        关闭
                    </button>
                </div>
            </div>
        `;
        
        DialogManager.show(dialogHTML);
    }

    showDriveSubfolders(drive, driveName, totalImageCount, subFolders) {
        let folderList = '';
        
        if (!subFolders || subFolders.length === 0) {
            folderList = `
                <div class="empty-folders">
                    <i class="fas fa-folder-open"></i>
                    <p>此盘符的DCIM文件夹中没有子文件夹</p>
                </div>
            `;
        } else {
            subFolders.forEach(folder => {
                folderList += `
                    <div class="subfolder-item ${folder.imported ? 'imported' : ''}" 
onclick="deviceDetection.importToOriginal('${folder.path.replace(/\\/g, '\\\\')}', '${folder.name}')">
                        <div class="subfolder-info">
                            <i class="fas fa-folder"></i>
                            <div>
                                <div class="subfolder-name">${folder.name}</div>
                                <small>${folder.imageCount} 张图片 · ${folder.lastModified}</small>
                            </div>
                        </div>
                        <div class="subfolder-status">
                            ${folder.imported ? 
                                '<span class="imported-badge"><i class="fas fa-check"></i> 已导入</span>' : 
                                '<span class="import-badge"><i class="fas fa-download"></i> 导入</span>'
                            }
                        </div>
                    </div>
                `;
            });
        }
        
        // 先关闭旧弹窗再打开新弹窗，避免弹窗堆叠
        DialogManager.close();
        setTimeout(() => {
            const dialogHTML = `
                <div class="drive-subfolders-dialog">
                    <div class="dialog-header">
                        <h3>选择要导入的文件夹</h3>
                    </div>
                    <div class="subfolder-list">
                        ${folderList}
                    </div>
                    <div class="dialog-footer" style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-end;">
                        <button onclick="DialogManager.close(); setTimeout(() => deviceDetection.showDeviceSelectionDialog(deviceDetection.lastDetectedDevices), 350);" class="btn btn-secondary">
                            <i class="fas fa-arrow-left"></i> 返回盘符列表
                        </button>
                        <button onclick="deviceDetection.clearImportHistory()" class="btn btn-sm btn-secondary" title="清除导入历史" style="margin-left:auto;">
                            <i class="fas fa-trash"></i> 清除历史
                        </button>
                        <button onclick="DialogManager.close()" class="btn btn-secondary">
                            关闭
                        </button>
                    </div>
                </div>
            `;
            DialogManager.show(dialogHTML);
        }, 350);
    }

    async clearImportHistory() {
        if (!confirm('确定要清除所有导入历史记录吗？这将重置所有文件夹的导入状态。')) {
            return;
        }
        
        try {
            const response = await fetch('/api/import-history', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                NotificationManager.show('导入历史已清除', 'success');
                // 重新检测设备以更新状态
                DialogManager.close();
                setTimeout(() => this.autoDetect(), 500);
            } else {
                NotificationManager.show('清除导入历史失败', 'error');
            }
        } catch (error) {
            console.error('清除导入历史失败:', error);
            NotificationManager.show('清除导入历史失败', 'error');
        }
    }

    // 向后兼容的方法
    async selectDevice(devicePath) {
        DialogManager.close();
        LoadingManager.show();
        
        try {
            const response = await fetch('/api/load-device-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: devicePath })
            });
            
            if (response.ok) {
                const data = await response.json();
                ImageManager.loadImages(data.path, data.images);
            } else {
                NotificationManager.show('加载设备图片失败', 'error');
            }
        } catch (error) {
            console.error('加载设备图片失败:', error);
            NotificationManager.show('加载设备图片失败', 'error');
        } finally {
            LoadingManager.hide();
        }
    }
    // 新增：导入到original目录
    async importToOriginal(fromPath, folderName) {
        DialogManager.close();
        LoadingManager.show();
        try {
            const importResp = await fetch('/api/import-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: fromPath })
            });
            if (importResp.ok) {
                NotificationManager.show('导入成功，正在刷新页面...', 'success');
                window.location.reload();
            } else {
                const error = await importResp.json();
                NotificationManager.show(`导入文件夹失败: ${error.error || '未知错误'}`, 'error');
            }
        } catch (error) {
            console.error('导入文件夹失败:', error);
            NotificationManager.show('导入文件夹失败', 'error');
        } finally {
            LoadingManager.hide();
        }
    }
}

// 创建全局实例
window.deviceDetection = new DeviceDetection();

// 保持向后兼容性
window.autoDetectDevices = () => window.deviceDetection.autoDetect();
window.showDeviceSelectionDialog = (devices) => window.deviceDetection.showDeviceSelectionDialog(devices);
window.showDriveSubfolders = (drive, driveName, totalImageCount, subFolders) => 
    window.deviceDetection.showDriveSubfolders(drive, driveName, totalImageCount, subFolders);
window.clearImportHistory = () => window.deviceDetection.clearImportHistory();
window.selectDevice = (devicePath) => window.deviceDetection.selectDevice(devicePath);
window.closeDeviceDialog = () => DialogManager.close();
