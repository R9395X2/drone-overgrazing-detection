// 导入管理模块
class ImportManager {
    constructor() {
        this.importProgressTimer = null;
    }

    async importDeviceFolderWithProgress(folderPath, folderName) {
        try {
            DialogManager.close();
            
            // 显示进度模态框
            DialogManager.showImportProgress();
            
            // 调用新的带进度的API
            const response = await fetch('/api/import-device-folder-with-progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ folderPath: folderPath })
            });
            
            if (response.ok) {
                const data = await response.json();
                const importId = data.importId;
                
                // 开始轮询进度
                this.startProgressPolling(importId, folderName);
            } else {
                const error = await response.json();
                DialogManager.hideImportProgress();
                NotificationManager.show(`导入失败: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('导入设备文件夹失败:', error);
            DialogManager.hideImportProgress();
            NotificationManager.show('导入设备文件夹失败', 'error');
        }
    }

    startProgressPolling(importId, folderName) {
        const pollProgress = async () => {
            try {
                const response = await fetch(`/api/import-progress/${importId}`);
                if (response.ok) {
                    const data = await response.json();
                    const progress = data.progress;
                    
                    DialogManager.updateImportProgress(progress);
                    
                    // 如果完成或出错，停止轮询
                    if (progress.phase === 'completed') {
                        clearInterval(this.importProgressTimer);
                        this.importProgressTimer = null;
                        
                        setTimeout(() => {
                            DialogManager.hideImportProgress();
                            // 跳转到detection.html，带taskId参数
                            if (progress.result && progress.result.task_id) {
                                window.location.href = `detection.html?taskId=${progress.result.task_id}`;
                            } else {
                                window.location.href = `detection.html`;
                            }
                        }, 1000);
                        
                    } else if (progress.phase === 'error') {
                        clearInterval(this.importProgressTimer);
                        this.importProgressTimer = null;
                        
                        setTimeout(() => {
                            DialogManager.hideImportProgress();
                            NotificationManager.show(`导入失败: ${progress.message}`, 'error');
                        }, 1000);
                    }
                } else {
                    // 如果请求失败，停止轮询
                    clearInterval(this.importProgressTimer);
                    this.importProgressTimer = null;
                    DialogManager.hideImportProgress();
                    NotificationManager.show('无法获取导入进度', 'error');
                }
            } catch (error) {
                console.error('轮询进度失败:', error);
                clearInterval(this.importProgressTimer);
                this.importProgressTimer = null;
                DialogManager.hideImportProgress();
                NotificationManager.show('无法获取导入进度', 'error');
            }
        };
        
        // 立即执行一次
        pollProgress();
        
        // 每500ms轮询一次
        this.importProgressTimer = setInterval(pollProgress, 500);
    }

    // 导入设备子文件夹（复制到图像库）- 保持向后兼容
    async importDeviceFolder(folderPath, folderName) {
        try {
            LoadingManager.show();
            
            const response = await fetch('/api/import-device-folder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ folderPath: folderPath })
            });
            
            if (response.ok) {
                const data = await response.json();
                DialogManager.close();
                imageManager.loadImages(data.path, data.images);
                
                // 显示详细的复制结果
                if (data.copyStats) {
                    NotificationManager.show(
                        `成功导入文件夹 "${folderName}" 到图像库\n` +
                        `复制了 ${data.copyStats.copied}/${data.copyStats.total} 张图片` +
                        (data.copyStats.errors > 0 ? `\n${data.copyStats.errors} 个文件复制失败` : ''),
                        'success'
                    );
                } else {
                    NotificationManager.show(`成功导入文件夹 "${folderName}": ${data.count} 张图片`, 'success');
                }
            } else {
                const error = await response.json();
                NotificationManager.show(`导入失败: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('导入设备文件夹失败:', error);
            NotificationManager.show('导入设备文件夹失败', 'error');
        } finally {
            LoadingManager.hide();
        }
    }
}

// 创建全局实例
window.importManager = new ImportManager();

// 将ImportManager添加到全局作用域
window.ImportManager = ImportManager;

// 保持向后兼容性
window.importDeviceFolderWithProgress = (folderPath, folderName) => 
    window.importManager.importDeviceFolderWithProgress(folderPath, folderName);
window.importDeviceFolder = (folderPath, folderName) => 
    window.importManager.importDeviceFolder(folderPath, folderName);
