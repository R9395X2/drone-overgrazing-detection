/**
 * 错误处理中间件
 * 统一处理服务器错误
 */

/**
 * 全局错误处理中间件
 */
function errorHandler(error, req, res, next) {
    console.error('服务器错误:', error);
    
    // 如果响应已经发送，则传递给默认的Express错误处理器
    if (res.headersSent) {
        return next(error);
    }
    
    // 根据错误类型设置状态码
    let statusCode = 500;
    let message = '内部服务器错误';
    
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = '请求数据验证失败';
    } else if (error.name === 'CastError') {
        statusCode = 400;
        message = '请求参数格式错误';
    } else if (error.code === 'ENOENT') {
        statusCode = 404;
        message = '文件或目录不存在';
    } else if (error.code === 'EACCES') {
        statusCode = 403;
        message = '访问权限不足';
    } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
        statusCode = 503;
        message = '系统资源不足';
    }
    
    // 构建错误响应
    const errorResponse = {
        error: message,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
    };
    
    // 在开发环境中包含详细错误信息
    if (process.env.NODE_ENV === 'development') {
        errorResponse.details = error.message;
        errorResponse.stack = error.stack;
    }
    
    res.status(statusCode).json(errorResponse);
}

/**
 * 404处理中间件
 */
function notFoundHandler(req, res, next) {
    const error = new Error(`路径未找到 - ${req.originalUrl}`);
    error.status = 404;
    next(error);
}

/**
 * 异步错误包装器
 * 用于包装异步路由处理器，自动捕获Promise错误
 */
function asyncWrapper(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 验证请求参数的中间件工厂
 */
function validateRequest(schema) {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            const validationError = new Error(error.details[0].message);
            validationError.name = 'ValidationError';
            return next(validationError);
        }
        next();
    };
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncWrapper,
    validateRequest
};
