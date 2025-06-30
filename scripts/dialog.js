// 对话框管理模块
class DialogManager {
    static show(html) {
        const dialog = document.createElement('div');
        dialog.className = 'custom-dialog-overlay';
        dialog.innerHTML = `
            <div class="custom-dialog">
                ${html}
            </div>
        `;
        
        document.body.appendChild(dialog);
        setTimeout(() => dialog.classList.add('show'), 100);
        
        // 存储引用以便后续关闭
        window.currentDialog = dialog;
    }

    static close() {
        if (window.currentDialog) {
            window.currentDialog.classList.remove('show');
            setTimeout(() => {
                window.currentDialog.remove();
                window.currentDialog = null;
            }, 300);
        }
    }

    static showProgress() {
        const elements = window.elements;
        elements.progressModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        this.updateProgress(0, '准备中...');
        
        // 模拟进度更新
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 95) {
                progress = 95;
                clearInterval(interval);
            }
            this.updateProgress(progress, this.getProgressText(progress));
        }, 300);
        
        // 存储interval以便后续清理
        elements.progressModal.dataset.interval = interval;
    }

    static hideProgress() {
        const elements = window.elements;
        // 清理进度更新间隔
        const interval = elements.progressModal.dataset.interval;
        if (interval) {
            clearInterval(interval);
            delete elements.progressModal.dataset.interval;
        }
        
        this.updateProgress(100, '处理完成');
        setTimeout(() => {
            elements.progressModal.classList.remove('show');
            document.body.style.overflow = 'auto';
        }, 500);
    }

    static updateProgress(percent, text) {
        const elements = window.elements;
        elements.progressFill.style.width = `${percent}%`;
        elements.progressText.textContent = text;
    }

    static getProgressText(progress) {
        if (progress < 20) return '初始化处理...';
        if (progress < 40) return '执行Python脚本...';
        if (progress < 60) return '分析处理结果...';
        if (progress < 80) return '生成报告...';
        if (progress < 95) return '完成处理...';
        return '处理完成';
    }

    static showImportProgress() {
        const progressModalHTML = `
            <div class="import-progress-modal">
                <div class="import-progress-content">
                    <div class="import-progress-header">
                        <h3><i class="fas fa-download"></i> 正在导入照片</h3>
                    </div>
                    <div class="import-progress-body">
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" id="importProgressFill"></div>
                            </div>
                            <div class="progress-info">
                                <span id="importProgressPercent">0%</span>
                                <span id="importProgressFiles">0/0 文件</span>
                            </div>
                        </div>
                        <div class="progress-message" id="importProgressMessage">
                            正在初始化导入...
                        </div>
                        <div class="progress-details" id="importProgressDetails">
                            <div class="progress-phase">
                                <i class="fas fa-clock"></i>
                                <span>按拍摄时间分类照片并复制到图像库</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.className = 'import-progress-overlay';
        modal.innerHTML = progressModalHTML;
        document.body.appendChild(modal);
        
        window.importProgressModal = modal;
        setTimeout(() => modal.classList.add('show'), 100);
    }

    static hideImportProgress() {
        if (window.importProgressModal) {
            window.importProgressModal.classList.remove('show');
            setTimeout(() => {
                if (window.importProgressModal && window.importProgressModal.parentNode) {
                    document.body.removeChild(window.importProgressModal);
                }
                window.importProgressModal = null;
            }, 300);
        }
        
        // 清理轮询定时器
        if (window.importProgressTimer) {
            clearInterval(window.importProgressTimer);
            window.importProgressTimer = null;
        }
    }

    static updateImportProgress(progress) {
        const progressFill = document.getElementById('importProgressFill');
        const progressPercent = document.getElementById('importProgressPercent');
        const progressFiles = document.getElementById('importProgressFiles');
        const progressMessage = document.getElementById('importProgressMessage');
        
        if (!progressFill) return;
        
        const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
        
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
        progressFiles.textContent = `${progress.current}/${progress.total} 文件`;
        progressMessage.textContent = progress.message || '正在处理...';
        
        // 根据阶段显示不同的颜色
        progressFill.className = 'progress-fill';
        if (progress.phase === 'analyzing') {
            progressFill.classList.add('analyzing');
        } else if (progress.phase === 'copying') {
            progressFill.classList.add('copying');
        } else if (progress.phase === 'completed') {
            progressFill.classList.add('completed');
        }
    }

    static showImportCompleted(result, folderName) {
        const completedDialogHTML = `
            <div class="import-completed-dialog">
                <div class="completed-header">
                    <div class="completed-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h3>导入完成！</h3>
                    <p>文件夹 "${folderName}" 已成功导入到图像库</p>
                </div>
                <div class="completed-stats">
                    <div class="stat-item">
                        <div class="stat-number">${result.copyStats.copied}</div>
                        <div class="stat-label">张图片</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${result.dateGroups || 1}</div>
                        <div class="stat-label">个日期分组</div>
                    </div>
                    ${result.copyStats.errors > 0 ? `
                    <div class="stat-item error">
                        <div class="stat-number">${result.copyStats.errors}</div>
                        <div class="stat-label">个错误</div>
                    </div>
                    ` : ''}
                </div>
                <div class="usb-removal-notice">
                    <div class="usb-icon">
                        <i class="fas fa-usb"></i>
                    </div>
                    <div class="usb-message">
                        <h4>现在可以安全地拔掉USB设备了</h4>
                        <p>所有照片已按拍摄时间分类保存到图像库，您可以安全地移除无人机存储设备。</p>
                    </div>
                </div>
                <div class="completed-actions">
                    <button onclick="DialogManager.close()" class="btn btn-primary">
                        <i class="fas fa-check"></i> 确定
                    </button>
                </div>
            </div>
        `;
        
        this.show(completedDialogHTML);
    }
}

// 将DialogManager添加到全局作用域
window.DialogManager = DialogManager;

// 保持向后兼容的全局函数
window.showCustomDialog = DialogManager.show.bind(DialogManager);
window.closeCustomDialog = DialogManager.close.bind(DialogManager);
window.showImportProgressModal = DialogManager.showImportProgress.bind(DialogManager);
window.hideImportProgressModal = DialogManager.hideImportProgress.bind(DialogManager);
window.closeImportCompletedDialog = DialogManager.close.bind(DialogManager);
