// 配置管理模块
class ConfigManager {
    constructor() {
        this.appConfig = null;
        this.availableScripts = [];
    }

    async loadConfiguration() {
        try {
            console.log('📋 正在加载配置...');
            
            // 加载应用配置
            const appConfigResponse = await fetch('/api/app-config');
            if (appConfigResponse.ok) {
                const appConfigData = await appConfigResponse.json();
                this.appConfig = appConfigData.config;
                console.log('✅ 应用配置加载成功');
            }
            
            // 加载脚本配置
            const scriptsResponse = await fetch('/api/config/scripts');
            if (scriptsResponse.ok) {
                const scriptsData = await scriptsResponse.json();
                this.availableScripts = scriptsData.scripts;
                console.log(`✅ 加载了 ${this.availableScripts.length} 个脚本配置`);
            }
            
        } catch (error) {
            console.error('❌ 配置加载失败:', error);
            NotificationManager.show('配置加载失败，使用默认设置', 'warning');
        }
    }

    getAppConfig() {
        return this.appConfig;
    }

    getAvailableScripts() {
        return this.availableScripts;
    }

    async saveAppConfig(newConfig) {
        try {
            const response = await fetch('/api/app-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ config: newConfig })
            });
            
            if (response.ok) {
                this.appConfig = newConfig;
                return true;
            } else {
                throw new Error('保存失败');
            }
        } catch (error) {
            console.error('保存设置失败:', error);
            throw error;
        }
    }
}

// 导出单例实例
window.configManager = new ConfigManager();
