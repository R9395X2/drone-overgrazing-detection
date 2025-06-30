# 按时间分类导入功能

## 功能概述

本次更新为无人机过度放牧检测系统添加了按时间自动分类导入功能，用户可以将无人机SD卡中的照片按拍摄时间自动分类导入到图像库中，并提供了实时进度条和USB设备拔除提示。

## 主要功能

### 1. 按时间自动分类
- **智能时间识别**：系统自动读取图片的拍摄时间（EXIF数据）或文件创建时间
- **自动文件夹创建**：按日期格式（YYYY-MM-DD）创建分类文件夹
- **文件夹命名**：格式为 `日期_原文件夹名`，如 `2025-06-17_DJI_202506161507_033`
- **重复文件处理**：支持重命名、跳过、覆盖三种冲突解决策略

### 2. 实时进度显示
- **两阶段进度**：
  - 阶段1：分析图片时间信息
  - 阶段2：按时间分类复制文件
- **详细进度信息**：显示当前进度百分比、已处理文件数/总文件数
- **进度条动画**：不同阶段显示不同颜色的进度条
- **实时状态更新**：每500ms轮询一次进度状态

### 3. USB设备拔除提示
- **安全拔除通知**：导入完成后明确提示用户可以安全拔掉USB设备
- **导入统计**：显示成功导入的图片数量、创建的日期分组数量
- **错误统计**：如有文件复制失败，显示错误数量

## 技术实现

### 后端实现 (server.js)

#### 1. 新增API端点
```javascript
// 带进度的导入API
POST /api/import-device-folder-with-progress
// 获取导入进度API
GET /api/import-progress/:importId
```

#### 2. 核心函数
- `getImageDate(imagePath)`: 获取图片拍摄时间
- `copyImagesToLibraryByDate()`: 按时间分类复制文件
- `importProgress`: 全局进度管理Map

#### 3. 时间分类逻辑
```javascript
// 获取图片时间
const imageDate = getImageDate(image.path);
const dateKey = imageDate.toISOString().split('T')[0]; // YYYY-MM-DD

// 创建日期文件夹
const dateFolderName = `${dateKey}_${folderName}`;
```

### 前端实现 (scripts/main.js)

#### 1. 新增功能函数
- `importDeviceFolderWithProgress()`: 启动带进度的导入
- `showImportProgressModal()`: 显示进度模态框
- `startProgressPolling()`: 开始进度轮询
- `updateImportProgress()`: 更新进度显示
- `showImportCompletedDialog()`: 显示完成对话框

#### 2. 进度轮询机制
```javascript
// 每500ms轮询一次进度
importProgressTimer = setInterval(pollProgress, 500);
```

#### 3. 用户界面更新
- 设备选择对话框增加了按时间分类导入说明
- 进度条支持不同阶段的颜色变化
- 完成对话框包含USB拔除提示

### 样式实现 (styles/import-progress.css)

#### 1. 进度模态框
```css
.import-progress-overlay {
    position: fixed;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10000;
}
```

#### 2. 进度条动画
```css
.progress-fill::after {
    animation: progress-shimmer 2s infinite;
}
```

#### 3. USB拔除提示
```css
.usb-removal-notice {
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    border-left: 5px solid #2196F3;
}
```

## 用户体验流程

### 1. 设备检测
1. 用户点击"自动检测设备"
2. 系统检测到无人机DCIM文件夹
3. 显示可选择的子文件夹列表

### 2. 导入过程
1. 用户选择要导入的文件夹
2. 系统显示进度模态框
3. 实时显示分析和复制进度
4. 按拍摄时间自动分类文件

### 3. 完成提示
1. 显示导入统计信息
2. 明确提示可以拔掉USB设备
3. 自动刷新图像库显示

## 配置选项

### 应用配置新增字段
```json
{
  "imageLibrary": {
    "classifyByDate": true  // 启用按时间分类
  }
}
```

### 冲突解决策略
- `rename`: 重命名重复文件
- `skip`: 跳过重复文件
- `overwrite`: 覆盖重复文件

## 兼容性

### 向后兼容
- 保留原有的 `/api/import-device-folder` API
- 支持不带进度的传统导入方式
- 现有配置文件无需修改

### 浏览器支持
- 支持现代浏览器的ES6+特性
- 使用CSS3动画和变换
- 响应式设计支持移动设备

## 错误处理

### 常见错误情况
1. **文件读取失败**：显示具体错误信息
2. **磁盘空间不足**：提示用户清理空间
3. **权限不足**：提示用户以管理员权限运行
4. **网络中断**：进度轮询失败时的优雅处理

### 错误恢复
- 自动重试机制
- 断点续传支持（未来版本）
- 详细的错误日志记录

## 性能优化

### 文件处理优化
- 异步文件复制避免阻塞
- 批量处理减少I/O操作
- 内存使用优化

### 进度更新优化
- 限制更新频率（500ms间隔）
- 避免频繁DOM操作
- 使用requestAnimationFrame优化动画

## 未来改进方向

1. **并行处理**：支持多线程文件复制
2. **断点续传**：支持中断后继续导入
3. **智能分类**：根据GPS信息进一步分类
4. **预览功能**：导入前预览文件结构
5. **自定义命名**：用户可自定义文件夹命名规则

## 文件变更清单

### 新增文件
- `styles/import-progress.css` - 进度条和完成对话框样式

### 修改文件
- `server.js` - 添加按时间分类和进度API
- `scripts/main.js` - 添加进度显示和轮询功能
- `index.html` - 引入新的CSS文件

### 配置文件
- `config/app.config.json` - 新增 `classifyByDate` 选项

## 测试建议

### 功能测试
1. 测试不同时间的图片分类
2. 测试大量文件的导入性能
3. 测试各种冲突解决策略
4. 测试网络中断时的行为

### 兼容性测试
1. 测试不同浏览器的兼容性
2. 测试移动设备的响应式显示
3. 测试不同操作系统的文件系统

### 用户体验测试
1. 测试进度显示的准确性
2. 测试USB拔除提示的时机
3. 测试错误信息的友好性
