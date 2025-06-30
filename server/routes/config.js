/**
 * 配置相关路由
 * 处理应用配置和脚本配置的API
 */

const express = require('express');
const router = express.Router();
const configManager = require('../../config/ConfigManager');
const { loadAppConfig, saveAppConfig } = require('../services/fileService');
const { asyncWrapper } = require('../middleware/errorHandler');

/**
 * 获取应用配置
 * GET /api/config/app
 */
router.get('/app', asyncWrapper(async (req, res) => {
    const config = loadAppConfig();
    res.json({
        success: true,
        config: config
    });
}));

/**
 * 更新应用配置
 * POST /api/config/app
 */
router.post('/app', asyncWrapper(async (req, res) => {
    const { config } = req.body;
    
    if (!config) {
        return res.status(400).json({ error: '配置数据不能为空' });
    }
    
    const success = saveAppConfig(config);
    if (success) {
        res.json({ success: true, message: '应用配置更新成功' });
    } else {
        res.status(500).json({ error: '应用配置更新失败' });
    }
}));

/**
 * 获取完整配置
 * GET /api/config
 */
router.get('/', asyncWrapper(async (req, res) => {
    const config = configManager.getConfig();
    res.json({
        success: true,
        config: config
    });
}));

/**
 * 更新完整配置
 * POST /api/config
 */
router.post('/', asyncWrapper(async (req, res) => {
    const { config } = req.body;
    
    if (!config) {
        return res.status(400).json({ error: '配置数据不能为空' });
    }
    
    const success = configManager.importConfig(JSON.stringify(config));
    if (success) {
        res.json({ success: true, message: '配置更新成功' });
    } else {
        res.status(500).json({ error: '配置更新失败' });
    }
}));

/**
 * 获取脚本配置
 * GET /api/config/scripts
 */
router.get('/scripts', asyncWrapper(async (req, res) => {
    const scripts = configManager.getAvailableScripts();
    res.json({
        success: true,
        scripts: scripts
    });
}));

/**
 * 更新脚本配置
 * POST /api/config/scripts
 */
router.post('/scripts', asyncWrapper(async (req, res) => {
    const { script } = req.body;
    
    if (!script || !script.id || !script.path) {
        return res.status(400).json({ error: '脚本配置不完整' });
    }
    
    const success = configManager.updateScript(script);
    if (success) {
        res.json({ success: true, message: '脚本配置更新成功' });
    } else {
        res.status(500).json({ error: '脚本配置更新失败' });
    }
}));

/**
 * 启用/禁用脚本
 * POST /api/config/scripts/:id/toggle
 */
router.post('/scripts/:id/toggle', asyncWrapper(async (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: '启用状态必须是布尔值' });
    }
    
    const success = configManager.toggleScript(id, enabled);
    if (success) {
        res.json({ success: true, message: '脚本状态更新成功' });
    } else {
        res.status(404).json({ error: '脚本不存在' });
    }
}));

/**
 * 获取配置验证报告
 * GET /api/config/validation
 */
router.get('/validation', asyncWrapper(async (req, res) => {
    const validation = configManager.getValidationReport();
    res.json({
        success: true,
        validation: validation
    });
}));

/**
 * 重新加载配置
 * POST /api/config/reload
 */
router.post('/reload', asyncWrapper(async (req, res) => {
    try {
        configManager.loadConfig();
        res.json({ success: true, message: '配置重新加载成功' });
    } catch (error) {
        res.status(500).json({ error: '配置重新加载失败: ' + error.message });
    }
}));

module.exports = router;
