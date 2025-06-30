# Node.js 服务器模块化架构说明

## 概述

本项目的Node.js服务器端代码已经重构为模块化架构，将原来的单一大文件 `server.js`（约2500行代码）拆分成多个专门的模块，提高了代码的可读性、可维护性和可扩展性。

## 文件结构

### 主要目录

```
server/
├── app.js                    # 主应用程序类
├── services/                 # 业务逻辑服务
│   ├── fileService.js       # 文件系统服务
│   ├── deviceService.js     # 设备检测服务
│   ├── importService.js     # 导入服务
│   └── processService.js    # 图像处理服务
├── routes/                   # API路由
│   ├── config.js            # 配置相关路由
│   └── index.js             # 路由汇总
├── middleware/               # 中间件
│   └── errorHandler.js      # 错误处理中间件
└── README.md                # 本文档
```

### 核心模块

#### `app.js` - 主应用程序类
- **职责**: 应用程序的入口点和协调中心
- **功能**:
  - 初始化Express应用
  - 设置中间件
  - 配置路由
  - 处理应用启动和关闭

#### `services/` - 业务逻辑服务

##### `fileService.js` - 文件系统服务
- **职责**: 处理文件和目录相关操作
- **功能**:
  - 应用配置的加载和保存
  - 图像库管理
  - 文件格式检查和大小格式化
  - 驱动器检测（Windows）
  - 图片文件的读取和处理

##### `deviceService.js` - 设备检测服务
- **职责**: 处理无人机设备的检测和识别
- **功能**:
  - 检测包含DCIM文件夹的盘符
  - 获取设备详细信息
  - 检查设备可访问性
  - 分析设备中的图片数量和文件夹结构

##### `importService.js` - 导入服务
- **职责**: 处理图片导入和历史记录管理
- **功能**:
  - 按时间分类导入图片
  - 导入历史记录管理
  - 文件冲突处理
  - 进度跟踪和回调
  - 文件复制和元数据提取

##### `processService.js` - 图像处理服务
- **职责**: 处理Python脚本调用和图像处理
- **功能**:
  - Python脚本的动态调用
  - 脚本结果处理和解析
  - 图片文件验证
  - 处理结果摘要生成
  - 临时文件清理

#### `routes/` - API路由模块

##### `config.js` - 配置相关路由
- **职责**: 处理应用配置和脚本配置的API
- **路由**:
  - `GET/POST /api/config/app` - 应用配置管理
  - `GET/POST /api/config` - 完整配置管理
  - `GET/POST /api/config/scripts` - 脚本配置管理
  - `POST /api/config/scripts/:id/toggle` - 脚本启用/禁用
  - `GET /api/config/validation` - 配置验证报告

##### `index.js` - 路由汇总
- **职责**: 将原server.js中的所有API路由模块化
- **功能**:
  - 图片加载和浏览
  - 文件夹选择和导航
  - 设备检测和导入
  - 图像处理和缩略图生成
  - 导入历史管理

#### `middleware/` - 中间件模块

##### `errorHandler.js` - 错误处理中间件
- **职责**: 统一处理服务器错误
- **功能**:
  - 全局错误处理
  - 404错误处理
  - 异步错误包装器
  - 请求参数验证

## 设计原则

### 1. 单一职责原则
每个服务模块只负责一个特定的业务领域：
- `fileService` - 文件系统操作
- `deviceService` - 设备检测
- `importService` - 数据导入
- `processService` - 图像处理

### 2. 模块化设计
- **服务层**: 处理业务逻辑，不直接处理HTTP请求
- **路由层**: 处理HTTP请求，调用服务层
- **中间件层**: 处理横切关注点（错误处理、验证等）

### 3. 错误处理
- 统一的错误处理机制
- 详细的错误日志记录
- 友好的错误响应格式

### 4. 向后兼容性
- 保持所有原有的API接口
- 现有的客户端代码无需修改
- 渐进式升级支持

## API路由映射

### 原路由 → 新模块映射

| 原路由 | 新模块 | 说明 |
|--------|--------|------|
| `/api/app-config` | `routes/config.js` | 应用配置管理 |
| `/api/config` | `routes/config.js` | 完整配置管理 |
| `/api/config/scripts` | `routes/config.js` | 脚本配置 |
| `/api/images/default` | `routes/index.js` | 默认图片加载 |
| `/api/browse` | `routes/index.js` | 文件夹浏览 |
| `/api/select-folder` | `routes/index.js` | 文件夹选择 |
| `/api/detect-devices` | `routes/index.js` | 设备检测 |
| `/api/import-*` | `routes/index.js` | 导入相关 |
| `/api/process-image` | `routes/index.js` | 图像处理 |
| `/api/thumbnail` | `routes/index.js` | 缩略图 |

## 使用方式

### 启动服务器
```javascript
const ServerApp = require('./server/app');
const serverApp = new ServerApp();
serverApp.start();
```

### 单独使用服务
```javascript
const { getImagesFromFolder } = require('./server/services/fileService');
const { detectDroneDevices } = require('./server/services/deviceService');

// 使用文件服务
const images = getImagesFromFolder('/path/to/folder');

// 使用设备检测服务
const devices = detectDroneDevices();
```

### 自定义配置
```javascript
const ServerApp = require('./server/app');

class CustomServerApp extends ServerApp {
    setupCustomRoutes() {
        this.app.get('/custom', (req, res) => {
            res.json({ message: 'Custom route' });
        });
    }
    
    setupRoutes() {
        super.setupRoutes();
        this.setupCustomRoutes();
    }
}
```

## 优势

### 1. 可读性提升
- 从单个2500行文件变为多个平均200-300行的专用模块
- 清晰的模块职责划分
- 更好的代码组织结构

### 2. 可维护性增强
- 修改特定功能时只需要编辑对应的模块
- 减少了代码冲突的可能性
- 更容易进行单元测试

### 3. 可扩展性改善
- 新功能可以作为独立模块添加
- 模块间的松耦合设计便于扩展
- 支持插件式开发

### 4. 调试便利
- 错误更容易定位到具体模块
- 模块化的日志记录
- 更清晰的调用堆栈

### 5. 团队协作友好
- 多人开发时减少代码冲突
- 清晰的模块边界
- 便于代码审查

## 迁移指南

### 对现有代码的影响
- **无影响**: 所有现有的API调用仍然有效
- **性能提升**: 模块化加载可能略微改善启动速度
- **调试改进**: 错误堆栈跟踪现在指向具体的模块文件

### 开发建议
1. **添加新功能时**:
   - 确定功能属于哪个服务模块
   - 在相应的服务中添加业务逻辑
   - 在路由中添加API接口

2. **修改现有功能时**:
   - 首先确定功能在哪个模块中
   - 避免跨模块的直接依赖
   - 通过服务接口进行模块间通信

3. **错误处理**:
   - 使用 `asyncWrapper` 包装异步路由
   - 抛出有意义的错误消息
   - 利用统一的错误处理中间件

## 测试

### 单元测试示例
```javascript
// 测试文件服务
const { getImagesFromFolder } = require('../server/services/fileService');

describe('FileService', () => {
    test('should return images from folder', () => {
        const images = getImagesFromFolder('./test-folder');
        expect(Array.isArray(images)).toBe(true);
    });
});
```

### 集成测试示例
```javascript
// 测试API路由
const request = require('supertest');
const ServerApp = require('../server/app');

describe('API Routes', () => {
    let app;
    
    beforeAll(() => {
        const serverApp = new ServerApp();
        app = serverApp.initialize();
    });
    
    test('GET /api/health', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
    });
});
```

这种模块化架构为项目的长期维护和发展奠定了坚实的基础，同时保持了完全的向后兼容性。
