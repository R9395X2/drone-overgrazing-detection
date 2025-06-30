/**
 * 主服务器文件 (模块化版本)
 * 
 * 原来的单一文件已经拆分为模块化架构：
 * - server/app.js - 主应用程序类
 * - server/services/ - 业务逻辑服务
 * - server/routes/ - API路由
 * - server/middleware/ - 中间件
 * 
 * 此文件现在作为入口点，使用新的模块化架构
 */

// 使用新的模块化服务器应用
const ServerApp = require('./server/app');

// 创建并启动服务器
const serverApp = new ServerApp();
serverApp.start();

// 导出应用实例以便测试
module.exports = serverApp.app;
