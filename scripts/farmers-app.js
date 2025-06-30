// 农户应用主入口
class FarmersApp {
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🚀 正在初始化农户管理系统...');
        
        try {
            // 等待DOM加载完成
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // 初始化农户管理器
            await farmersManager.initialize();
            
            this.isInitialized = true;
            console.log('✅ 农户管理系统初始化完成');
            
        } catch (error) {
            console.error('❌ 农户管理系统初始化失败:', error);
            if (window.NotificationManager) {
                NotificationManager.show('农户管理系统初始化失败', 'error');
            }
        }
    }
}

// 创建全局应用实例
window.farmersApp = new FarmersApp();

// 应用初始化
document.addEventListener('DOMContentLoaded', function() {
    window.farmersApp.initialize();
});

// 保持向后兼容的全局函数
window.initializeFarmersApp = () => window.farmersApp.initialize();
