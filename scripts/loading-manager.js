// 加载管理模块
class LoadingManager {
    static show() {
        const elements = window.elements;
        if (elements && elements.loadingSpinner) {
            elements.loadingSpinner.style.display = 'flex';
        }
    }

    static hide() {
        const elements = window.elements;
        if (elements && elements.loadingSpinner) {
            elements.loadingSpinner.style.display = 'none';
        }
    }
}

// 将LoadingManager添加到全局作用域
window.LoadingManager = LoadingManager;

// 保持向后兼容性
window.showLoading = LoadingManager.show;
