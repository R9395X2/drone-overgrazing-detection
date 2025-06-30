/**
 * 主应用文件 (遗留兼容性支持)
 * 
 * 此文件现在主要用于向后兼容性。
 * 大部分功能已经迁移到模块化的JavaScript文件中：
 * - scripts/app.js - 主应用逻辑
 * - scripts/config.js - 配置管理
 * - scripts/notification.js - 通知系统
 * - scripts/dialog.js - 对话框管理
 * - scripts/folder-browser.js - 文件夹浏览器
 * - scripts/device-detection.js - 设备检测
 * - scripts/image-manager.js - 图像管理
 * - scripts/import-manager.js - 导入管理
 * - scripts/settings.js - 设置管理
 * - scripts/loading-manager.js - 加载管理
 */

// 向后兼容性：确保全局变量存在
window.currentImages = window.currentImages || [];
window.currentPath = window.currentPath || '';
window.currentView = window.currentView || 'grid';
window.selectedImage = window.selectedImage || null;
window.appConfig = window.appConfig || null;
window.availableScripts = window.availableScripts || [];
window.importProgressTimer = window.importProgressTimer || null;
window.currentSortBy = window.currentSortBy || 'date';
window.currentGroupBy = window.currentGroupBy || 'date';
window.currentSortOrder = window.currentSortOrder || 'desc';

// 向后兼容性：如果新模块系统未加载，显示警告
// 兼容性警告，仅在新系统未加载时提示，不再自动加载图片
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (!window.app || !window.app.isInitialized) {
            console.warn('⚠️ 新的模块化系统未正确加载，可能存在兼容性问题');
            console.log('📋 请确保以下脚本文件已正确加载：');
            console.log('  - scripts/notification.js');
            console.log('  - scripts/loading-manager.js');
            console.log('  - scripts/config.js');
            console.log('  - scripts/dialog.js');
            console.log('  - scripts/folder-browser.js');
            console.log('  - scripts/device-detection.js');
            console.log('  - scripts/import-manager.js');
            console.log('  - scripts/image-manager.js');
            console.log('  - scripts/settings.js');
            console.log('  - scripts/app.js');
            
            // 如果新系统未加载，显示用户友好的错误信息
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #f8d7da;
                color: #721c24;
                padding: 20px;
                border: 1px solid #f5c6cb;
                border-radius: 8px;
                z-index: 10000;
                max-width: 500px;
                text-align: center;
                font-family: Arial, sans-serif;
            `;
            errorDiv.innerHTML = `
                <h3>⚠️ 系统加载异常</h3>
                <p>模块化系统未正确初始化，请刷新页面重试。</p>
                <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    刷新页面
                </button>
            `;
            document.body.appendChild(errorDiv);
        }
    }, 2000);
});

// 导出一些关键功能以确保向后兼容性
// 这些函数现在主要是代理到新的模块化系统

// 如果新系统可用，则代理到新系统；否则提供基本功能
window.showNotification = window.showNotification || function(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message); // 降级到基本alert
};

window.showLoading = window.showLoading || function(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
};

// 确保元素引用可用
if (!window.elements && typeof document !== 'undefined') {
    window.elements = {
        selectFolderBtn: document.getElementById('selectFolderBtn'),
        autoDetectBtn: document.getElementById('autoDetectBtn'),
        gridViewBtn: document.getElementById('gridViewBtn'),
        listViewBtn: document.getElementById('listViewBtn'),
        imageGallery: document.getElementById('imageGallery'),
        emptyState: document.getElementById('emptyState'),
        loadingSpinner: document.getElementById('loadingSpinner'),
        currentPath: document.getElementById('currentPath'),
        imageCount: document.getElementById('imageCount'),
        sortBy: document.getElementById('sortBy'),
        groupBy: document.getElementById('groupBy'),
        sortOrderBtn: document.getElementById('sortOrderBtn'),
        sortOrderIcon: document.getElementById('sortOrderIcon'),
        processModal: document.getElementById('processModal'),
        resultModal: document.getElementById('resultModal'),
        progressModal: document.getElementById('progressModal'),
        closeModal: document.getElementById('closeModal'),
        previewImage: document.getElementById('previewImage'),
        imageName: document.getElementById('imageName'),
        imageSize: document.getElementById('imageSize'),
        startProcessBtn: document.getElementById('startProcessBtn'),
        cancelProcessBtn: document.getElementById('cancelProcessBtn'),
        closeResultModal: document.getElementById('closeResultModal'),
        resultContent: document.getElementById('resultContent'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        detectOvergrazing: document.getElementById('detectOvergrazing'),
        generateReport: document.getElementById('generateReport'),
        saveResults: document.getElementById('saveResults')
    };
}

console.log('📄 main.js (兼容性模式) 已加载');
