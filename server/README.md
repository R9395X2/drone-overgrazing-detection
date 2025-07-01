# server 目录说明

本目录为无人机过度放牧检测系统的后端服务，基于 Node.js，负责提供 API 接口、业务逻辑处理和中间件支持。

## 目录结构与文件说明

- `app.js`：后端服务主入口，初始化 Express 应用。

### middleware/
- `errorHandler.js`：全局错误处理中间件，捕获并统一处理API请求中的异常。

### routes/
- `checks.js`：健康检查相关API路由。
- `config.js`：系统配置相关API路由。
- `count.js`：羊只计数相关API路由。
- `farmers.js`：农户信息管理相关API路由。
- `import-folder.js`：导入文件夹相关API路由。
- `index.js`：路由聚合与分发入口。
- `temp-folder.js`：临时文件夹管理相关API路由。

### services/
- `deviceService.js`：设备管理与操作相关的业务逻辑。
- `fileService.js`：文件处理与管理相关的业务逻辑。
- `importService.js`：导入数据、文件夹等相关的业务逻辑。


新增路由或服务时，请遵循现有结构，保持代码模块化和注释规范，便于维护和扩展。
