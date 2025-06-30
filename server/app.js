/**
 * 主服务器应用程序
 * 负责初始化Express应用和中间件
 */

const express = require('express');
const cors = require('cors');
const configManager = require('../config/ConfigManager');

// 导入路由模块
const configRoutes = require('./routes/config');
const { setupRoutes } = require('./routes/index');

// 导入错误处理中间件
const { errorHandler } = require('./middleware/errorHandler');

class ServerApp {
    constructor() {
        this.app = express();
        this.PORT = process.env.PORT || 3000;
    }

    setupMiddleware() {
        // 基础中间件
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('.'));
    }

    setupRoutes() {
        // 设置所有API路由
        setupRoutes(this.app);
        
        // 健康检查端点
        this.app.get('/api/health', this.healthCheck.bind(this));
    }

    setupErrorHandling() {
        // 错误处理中间件
        this.app.use(errorHandler);
    }

    healthCheck(req, res) {
        const validation = configManager.getValidationReport();
        const { getImageLibraryPath } = require('./services/fileService');
        const fs = require('fs');
        const libraryPath = getImageLibraryPath();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            config: {
                directories: validation.directories,
                scripts: validation.scripts
            },
            imageLibrary: {
                path: libraryPath,
                exists: fs.existsSync(libraryPath)
            }
        });
    }

    initialize() {
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        return this.app;
    }

    start() {
        this.initialize();
        
        this.app.listen(this.PORT, () => {
            this.logStartupInfo();
        });

        // 优雅关闭
        process.on('SIGINT', () => {
            console.log('\n📴 正在关闭服务器...');
            process.exit(0);
        });
    }

    logStartupInfo() {
        console.log(`🚀 无人机过度放牧检测系统服务器已启动`);
        console.log(`📍 访问地址: http://localhost:${this.PORT}`);
        console.log(`🔧 API端点: http://localhost:${this.PORT}/api`);
        console.log(`📝 健康检查: http://localhost:${this.PORT}/api/health`);
        
        // 检查图像库
        const { getImageLibraryPath, ensureImageLibraryExists } = require('./services/fileService');
        const libraryPath = getImageLibraryPath();
        console.log(`📁 图像库路径: ${libraryPath}`);
        if (ensureImageLibraryExists()) {
            console.log(`✅ 图像库可用`);
        } else {
            console.log(`❌ 图像库不可用`);
        }
        
        // 输出配置验证报告
        const validation = configManager.getValidationReport();
        console.log(`📁 有效目录: ${validation.directories.valid.length}`);
        console.log(`📁 无效目录: ${validation.directories.invalid.length}`);
        console.log(`🐍 有效脚本: ${validation.scripts.valid.length}`);
        console.log(`🐍 无效脚本: ${validation.scripts.invalid.length}`);
    }
}

module.exports = ServerApp;
