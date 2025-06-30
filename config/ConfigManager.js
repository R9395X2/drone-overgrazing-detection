const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, 'config.json');
        this.config = null;
        this.loadConfig();
    }

    // 加载配置文件
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                this.config = JSON.parse(configData);
                console.log('✅ 配置文件加载成功');
            } else {
                console.warn('⚠️ 配置文件不存在，使用默认配置');
                this.config = this.getDefaultConfig();
                this.saveConfig();
            }
        } catch (error) {
            console.error('❌ 加载配置文件失败:', error);
            this.config = this.getDefaultConfig();
        }
    }

    // 保存配置文件
    saveConfig() {
        try {
            const configData = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(this.configPath, configData, 'utf8');
            console.log('✅ 配置文件保存成功');
            return true;
        } catch (error) {
            console.error('❌ 保存配置文件失败:', error);
            return false;
        }
    }

    // 获取默认配置
    getDefaultConfig() {
        return {
            directories: {
                default: "D:\\CYWRJGDFMJCXT",
                alternatives: []
            },
            scripts: {
                available: []
            },
            ui: {
                defaultView: "grid",
                autoLoadDirectory: true,
                showProcessingOptions: true,
                maxConcurrentProcessing: 3,
                enableBatchProcessing: true
            },
            processing: {
                timeout: 300,
                retryAttempts: 2,
                saveOriginalResults: true,
                generateThumbnails: true
            }
        };
    }

    // 获取完整配置
    getConfig() {
        return this.config;
    }

    // 获取目录配置
    getDirectories() {
        return this.config.directories;
    }

    // 获取默认目录
    getDefaultDirectory() {
        return this.config.directories.default;
    }

    // 设置默认目录
    setDefaultDirectory(directory) {
        this.config.directories.default = directory;
        return this.saveConfig();
    }

    // 添加备用目录
    addAlternativeDirectory(directory) {
        if (!this.config.directories.alternatives.includes(directory)) {
            this.config.directories.alternatives.push(directory);
            return this.saveConfig();
        }
        return true;
    }

    // 移除备用目录
    removeAlternativeDirectory(directory) {
        const index = this.config.directories.alternatives.indexOf(directory);
        if (index > -1) {
            this.config.directories.alternatives.splice(index, 1);
            return this.saveConfig();
        }
        return true;
    }

    // 获取所有可用脚本
    getAvailableScripts() {
        return this.config.scripts.available;
    }

    // 获取启用的脚本
    getEnabledScripts() {
        return this.config.scripts.available.filter(script => script.enabled);
    }

    // 根据ID获取脚本
    getScriptById(id) {
        return this.config.scripts.available.find(script => script.id === id);
    }

    // 添加或更新脚本
    updateScript(scriptConfig) {
        const existingIndex = this.config.scripts.available.findIndex(
            script => script.id === scriptConfig.id
        );

        if (existingIndex !== -1) {
            this.config.scripts.available[existingIndex] = scriptConfig;
        } else {
            this.config.scripts.available.push(scriptConfig);
        }

        return this.saveConfig();
    }

    // 启用/禁用脚本
    toggleScript(id, enabled) {
        const script = this.getScriptById(id);
        if (script) {
            script.enabled = enabled;
            return this.saveConfig();
        }
        return false;
    }

    // 移除脚本
    removeScript(id) {
        const index = this.config.scripts.available.findIndex(script => script.id === id);
        if (index > -1) {
            this.config.scripts.available.splice(index, 1);
            return this.saveConfig();
        }
        return false;
    }

    // 获取UI配置
    getUIConfig() {
        return this.config.ui;
    }

    // 更新UI配置
    updateUIConfig(uiConfig) {
        this.config.ui = { ...this.config.ui, ...uiConfig };
        return this.saveConfig();
    }

    // 获取处理配置
    getProcessingConfig() {
        return this.config.processing;
    }

    // 更新处理配置
    updateProcessingConfig(processingConfig) {
        this.config.processing = { ...this.config.processing, ...processingConfig };
        return this.saveConfig();
    }

    // 验证目录是否存在
    validateDirectory(directory) {
        try {
            return fs.existsSync(directory) && fs.statSync(directory).isDirectory();
        } catch (error) {
            return false;
        }
    }

    // 验证脚本文件是否存在
    validateScript(scriptPath) {
        try {
            const fullPath = path.resolve(scriptPath);
            return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
        } catch (error) {
            return false;
        }
    }

    // 获取配置验证报告
    getValidationReport() {
        const report = {
            directories: {
                valid: [],
                invalid: []
            },
            scripts: {
                valid: [],
                invalid: []
            }
        };

        // 验证目录
        const defaultDir = this.getDefaultDirectory();
        if (this.validateDirectory(defaultDir)) {
            report.directories.valid.push(defaultDir);
        } else {
            report.directories.invalid.push(defaultDir);
        }

        this.config.directories.alternatives.forEach(dir => {
            if (this.validateDirectory(dir)) {
                report.directories.valid.push(dir);
            } else {
                report.directories.invalid.push(dir);
            }
        });

        // 验证脚本
        this.config.scripts.available.forEach(script => {
            if (this.validateScript(script.path)) {
                report.scripts.valid.push(script);
            } else {
                report.scripts.invalid.push(script);
            }
        });

        return report;
    }

    // 重新加载配置
    reloadConfig() {
        this.loadConfig();
        return this.config;
    }

    // 导出配置
    exportConfig() {
        return JSON.stringify(this.config, null, 2);
    }

    // 导入配置
    importConfig(configString) {
        try {
            const newConfig = JSON.parse(configString);
            this.config = newConfig;
            return this.saveConfig();
        } catch (error) {
            console.error('❌ 导入配置失败:', error);
            return false;
        }
    }

    // 重置为默认配置
    resetToDefault() {
        this.config = this.getDefaultConfig();
        return this.saveConfig();
    }
}

// 创建单例实例
const configManager = new ConfigManager();

module.exports = configManager;
