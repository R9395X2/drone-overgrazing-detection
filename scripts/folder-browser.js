// 文件夹浏览器模块
class FolderBrowser {
    constructor() {
        this.currentBrowsePath = '';
        this.modal = null;
    }

    async show() {
        const folderBrowserHTML = `
            <div class="folder-browser-modal">
                <div class="folder-browser-content">
                    <div class="folder-browser-header">
                        <h3><i class="fas fa-folder-open"></i> 选择文件夹</h3>
                        <button class="modal-close" onclick="folderBrowser.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="folder-browser-body">
                        <div class="folder-path-bar">
                            <span id="folderCurrentPath">正在加载...</span>
                            <button id="folderUpBtn" class="btn btn-sm" title="上级目录">
                                <i class="fas fa-level-up-alt"></i>
                            </button>
                        </div>
                        <div class="folder-list-container">
                            <div id="folderList" class="folder-list">
                                <div class="loading-folders">
                                    <div class="spinner"></div>
                                    <p>正在加载文件夹...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="folder-browser-footer">
                        <button id="selectCurrentFolderBtn" class="btn btn-primary" disabled>
                            <i class="fas fa-check"></i> 选择当前文件夹
                        </button>
                        <button onclick="folderBrowser.close()" class="btn btn-secondary">
                            <i class="fas fa-times"></i> 取消
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 创建模态框
        this.modal = document.createElement('div');
        this.modal.className = 'folder-browser-overlay';
        this.modal.innerHTML = folderBrowserHTML;
        document.body.appendChild(this.modal);
        
        // 绑定事件
        const upBtn = this.modal.querySelector('#folderUpBtn');
        const selectBtn = this.modal.querySelector('#selectCurrentFolderBtn');
        
        upBtn.addEventListener('click', () => this.navigateUp());
        selectBtn.addEventListener('click', () => this.selectCurrentFolder());
        
        // 显示模态框
        setTimeout(() => this.modal.classList.add('show'), 100);
        
        // 加载初始文件夹
        await this.loadFolderContent('');
    }

    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(this.modal);
                this.modal = null;
                this.currentBrowsePath = '';
            }, 300);
        }
    }

    async loadFolderContent(path) {
        try {
            const folderList = document.getElementById('folderList');
            const pathSpan = document.getElementById('folderCurrentPath');
            const upBtn = document.getElementById('folderUpBtn');
            const selectBtn = document.getElementById('selectCurrentFolderBtn');
            
            if (!folderList) return;
            
            // 显示加载状态
            folderList.innerHTML = `
                <div class="loading-folders">
                    <div class="spinner"></div>
                    <p>正在加载文件夹...</p>
                </div>
            `;
            
            const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
            
            if (!response.ok) {
                throw new Error('加载文件夹失败');
            }
            
            const data = await response.json();
            
            // 更新当前路径
            this.currentBrowsePath = data.currentPath;
            pathSpan.textContent = data.currentPath || '计算机';
            
            // 更新上级按钮状态
            upBtn.disabled = !data.parent;
            
            // 更新选择按钮状态
            selectBtn.disabled = !data.currentPath;
            
            // 渲染文件夹列表
            this.renderFolderList(data.folders, data.parent);
            
        } catch (error) {
            console.error('加载文件夹失败:', error);
            const folderList = document.getElementById('folderList');
            if (folderList) {
                folderList.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>加载文件夹失败: ${error.message}</p>
                    </div>
                `;
            }
        }
    }

    renderFolderList(folders, parentPath) {
        const folderList = document.getElementById('folderList');
        if (!folderList) return;
        
        if (folders.length === 0) {
            folderList.innerHTML = `
                <div class="empty-folders">
                    <i class="fas fa-folder-open"></i>
                    <p>此文件夹为空或无可访问的子文件夹</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        folders.forEach(folder => {
            const iconClass = folder.type === 'drive' ? 'fas fa-hdd' : 'fas fa-folder';
            html += `
                <div class="folder-item" onclick="folderBrowser.navigateToFolder('${folder.path.replace(/\\/g, '\\\\')}')">
                    <div class="folder-icon">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="folder-info">
                        <div class="folder-name">${folder.name}</div>
                    </div>
                    <div class="folder-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        });
        
        folderList.innerHTML = html;
    }

    async navigateToFolder(path) {
        await this.loadFolderContent(path);
    }

    async navigateUp() {
        const upBtn = document.getElementById('folderUpBtn');
        if (upBtn && !upBtn.disabled) {
            const currentPath = this.currentBrowsePath;
            if (currentPath) {
                const parentPath = currentPath.split('\\').slice(0, -1).join('\\');
                await this.loadFolderContent(parentPath);
            }
        }
    }

async selectCurrentFolder() {
    const selectedFolder = this.currentBrowsePath;
    if (selectedFolder) {
        this.close();
        try {
            LoadingManager.show();
            // 直接将所选文件夹内容导入到temp_folder/original
            const importResp = await fetch('/api/import-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: selectedFolder })
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
}

// 创建全局实例
window.folderBrowser = new FolderBrowser();

// 保持向后兼容性
window.showFolderBrowser = () => window.folderBrowser.show();
window.closeFolderBrowser = () => window.folderBrowser.close();
window.navigateToFolder = (path) => window.folderBrowser.navigateToFolder(path);
