// 设置管理模块
class SettingsManager {
    constructor() {
        this.modal = null;
    }

    open() {
        const appConfig = configManager.getAppConfig();
        
        const settingsHTML = `
            <div class="settings-modal">
                <div class="settings-content">
                    <div class="settings-header">
                        <h3><i class="fas fa-cog"></i> 系统设置</h3>
                        <button class="modal-close" onclick="settingsManager.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="settings-body">
                        <div class="setting-group">
                            <h4>图像库设置</h4>
                            <div class="setting-item">
                                <label for="imageLibraryPath">图像库路径</label>
                                <div class="path-input-group">
                                    <input type="text" id="imageLibraryPath" class="form-control" 
                                           value="${appConfig ? appConfig.imageLibrary.path : 'D:\\CYWRJGDFMJCXT'}" />
                                    <button class="btn btn-secondary" onclick="settingsManager.browseImageLibraryPath()">
                                        <i class="fas fa-folder-open"></i> 浏览
                                    </button>
                                </div>
                                <small>选择用于存储导入图片的目录</small>
                            </div>
                            <div class="setting-item">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="autoCreateLibrary" 
                                           ${appConfig && appConfig.imageLibrary.autoCreate ? 'checked' : ''} />
                                    <span>自动创建图像库目录</span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="classifyByDate" 
                                           ${appConfig && appConfig.imageLibrary.classifyByDate ? 'checked' : ''} />
                                    <span>按拍摄时间自动分类照片</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="setting-group">
                            <h4>导入设置</h4>
                            <div class="setting-item">
                                <label for="conflictResolution">文件冲突处理</label>
                                <select id="conflictResolution" class="form-control">
                                    <option value="rename" ${appConfig && appConfig.import.conflictResolution === 'rename' ? 'selected' : ''}>重命名</option>
                                    <option value="skip" ${appConfig && appConfig.import.conflictResolution === 'skip' ? 'selected' : ''}>跳过</option>
                                    <option value="overwrite" ${appConfig && appConfig.import.conflictResolution === 'overwrite' ? 'selected' : ''}>覆盖</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="setting-group">
                            <h4>界面设置</h4>
                            <div class="setting-item">
                                <label for="defaultView">默认视图</label>
                                <select id="defaultView" class="form-control">
                                    <option value="grid" ${appConfig && appConfig.ui.defaultView === 'grid' ? 'selected' : ''}>网格视图</option>
                                    <option value="list" ${appConfig && appConfig.ui.defaultView === 'list' ? 'selected' : ''}>列表视图</option>
                                </select>
                            </div>
                            <div class="setting-item">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="enableAnimations" checked />
                                    <span>启用动画效果</span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="showNotifications" checked />
                                    <span>显示通知消息</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="setting-group">
                            <h4>高级设置</h4>
                            <div class="setting-item">
                                <label for="maxThumbnailSize">缩略图最大尺寸</label>
                                <select id="maxThumbnailSize" class="form-control">
                                    <option value="200">200px</option>
                                    <option value="300" selected>300px</option>
                                    <option value="400">400px</option>
                                </select>
                                <small>控制图片缩略图的显示尺寸</small>
                            </div>
                            <div class="setting-item">
                                <label for="imageQuality">图片质量</label>
                                <select id="imageQuality" class="form-control">
                                    <option value="low">低质量</option>
                                    <option value="medium" selected>中等质量</option>
                                    <option value="high">高质量</option>
                                </select>
                                <small>影响缩略图的生成质量和加载速度</small>
                            </div>
                            <div class="setting-item">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="enableDebugMode" />
                                    <span>启用调试模式</span>
                                </label>
                                <small>在控制台显示详细的调试信息</small>
                            </div>
                        </div>
                        
                        <div class="setting-group">
                            <h4>性能设置</h4>
                            <div class="setting-item">
                                <label for="maxConcurrentProcesses">最大并发处理数</label>
                                <select id="maxConcurrentProcesses" class="form-control">
                                    <option value="1">1个</option>
                                    <option value="2" selected>2个</option>
                                    <option value="4">4个</option>
                                    <option value="8">8个</option>
                                </select>
                                <small>同时处理的图片数量，数值越高处理越快但占用更多资源</small>
                            </div>
                            <div class="setting-item">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="enableCache" checked />
                                    <span>启用缓存</span>
                                </label>
                                <small>缓存已处理的结果以提高后续访问速度</small>
                            </div>
                        </div>
                    </div>
                    <div class="settings-footer">
                        <button class="btn btn-primary" onclick="settingsManager.save()">
                            <i class="fas fa-save"></i> 保存设置
                        </button>
                        <button class="btn btn-secondary" onclick="settingsManager.close()">
                            <i class="fas fa-times"></i> 取消
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.modal = document.createElement('div');
        this.modal.className = 'settings-overlay';
        this.modal.innerHTML = settingsHTML;
        document.body.appendChild(this.modal);
        
        // 防止背景滚动
        document.body.style.overflow = 'hidden';
        
        // 阻止滚动事件冒泡到背景
        this.modal.addEventListener('wheel', function(e) {
            e.stopPropagation();
        });
        
        setTimeout(() => this.modal.classList.add('show'), 100);
    }

    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
            // 恢复背景滚动
            document.body.style.overflow = 'auto';
            setTimeout(() => {
                document.body.removeChild(this.modal);
                this.modal = null;
            }, 300);
        }
    }

    async save() {
        try {
            const newConfig = {
                imageLibrary: {
                    path: document.getElementById('imageLibraryPath').value,
                    autoCreate: document.getElementById('autoCreateLibrary').checked,
                    copyOriginals: true,
                    classifyByDate: document.getElementById('classifyByDate').checked
                },
                ui: {
                    autoLoadDirectory: true,
                    defaultView: document.getElementById('defaultView').value,
                    theme: 'default'
                },
                import: {
                    preserveStructure: true,
                    addTimestamp: false,
                    conflictResolution: document.getElementById('conflictResolution').value
                }
            };
            
            await configManager.saveAppConfig(newConfig);
            this.close();
            NotificationManager.show('设置保存成功', 'success');
        } catch (error) {
            console.error('保存设置失败:', error);
            NotificationManager.show('设置保存失败', 'error');
        }
    }

    async browseImageLibraryPath() {
        // 使用现有的文件夹浏览器
        const currentInput = document.getElementById('imageLibraryPath');
        const originalSelectFunction = folderBrowser.selectCurrentFolder;
        
        // 临时重写选择函数
        folderBrowser.selectCurrentFolder = function() {
            const selectedPath = folderBrowser.currentBrowsePath;
            if (selectedPath) {
                currentInput.value = selectedPath;
                folderBrowser.close();
            }
        };
        
        // 显示文件夹浏览器
        await folderBrowser.show();
        
        // 关闭时恢复原函数
        const observer = new MutationObserver((mutations) => {
            if (!folderBrowser.modal) {
                folderBrowser.selectCurrentFolder = originalSelectFunction;
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });
    }
}

// 创建全局实例
window.settingsManager = new SettingsManager();

// 保持向后兼容性
window.openSettingsModal = () => window.settingsManager.open();
window.closeSettingsModal = () => window.settingsManager.close();
window.saveSettings = () => window.settingsManager.save();
window.browseImageLibraryPath = () => window.settingsManager.browseImageLibraryPath();
