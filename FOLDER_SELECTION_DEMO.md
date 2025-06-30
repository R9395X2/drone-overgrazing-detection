# 文件夹选择功能实现说明

## 功能概述

我已成功为你的无人机过度放牧检测系统实现了文件夹选择功能。当用户点击"选择文件夹"按钮时，会弹出一个文件夹浏览器对话框，用户可以导航并选择包含图片的文件夹。

## 实现的功能

### 1. 文件夹浏览器界面
- **文件夹路径栏**: 显示当前浏览路径
- **上级目录按钮**: 返回上一级文件夹
- **文件夹列表**: 显示当前目录下的所有子文件夹和驱动器
- **选择按钮**: 确认选择当前文件夹
- **取消按钮**: 关闭文件夹浏览器

### 2. 后端API支持
- **GET /api/browse**: 获取指定路径下的文件夹列表
- **POST /api/select-folder**: 选择文件夹并返回其中的图片

### 3. 用户交互流程
1. 用户点击"选择文件夹"按钮
2. 打开文件夹浏览器模态框
3. 显示系统驱动器列表（C:, D:, E: 等）
4. 用户可以点击文件夹进入子目录
5. 点击"上级目录"按钮返回上一级
6. 点击"选择当前文件夹"确认选择
7. 系统读取选中文件夹中的图片文件
8. 在主界面显示图片列表

## 技术实现

### 前端 (JavaScript)
```javascript
// 文件夹选择功能
async function selectFolder() {
    showFolderBrowser();
}

// 显示文件夹浏览器
async function showFolderBrowser() {
    // 创建模态框HTML
    // 绑定事件监听器
    // 加载初始文件夹内容
}

// 导航到指定文件夹
async function navigateToFolder(path) {
    await loadFolderContent(path);
}

// 选择当前文件夹
async function selectCurrentFolder() {
    // 调用后端API选择文件夹
    // 加载图片列表
}
```

### 后端 (Node.js)
```javascript
// 浏览文件夹API
app.get('/api/browse', (req, res) => {
    const { path: requestPath } = req.query;
    
    if (!requestPath) {
        // 返回驱动器列表
        const drives = getDrives();
        // ...
    } else {
        // 返回指定路径下的文件夹
        const folders = getSubFolders(requestPath);
        // ...
    }
});

// 选择文件夹API
app.post('/api/select-folder', (req, res) => {
    const { folderPath } = req.body;
    const images = getImagesFromFolder(folderPath);
    res.json({ path: folderPath, images: images });
});
```

### 样式 (CSS)
- 创建了专门的 `styles/folder-browser.css` 文件
- 响应式设计，支持移动端
- 美观的文件夹图标和悬停效果
- 加载状态和错误状态处理

## 文件结构

```
d:/drone-overgrazing-detection/
├── index.html                 # 主HTML文件（已添加CSS引用）
├── server.js                  # 后端服务器（已添加浏览API）
├── scripts/
│   └── main.js               # 前端JS（已实现文件夹选择功能）
└── styles/
    ├── main.css              # 主样式文件
    └── folder-browser.css    # 文件夹浏览器专用样式
```

## 如何运行

1. 确保安装了Node.js
2. 在项目目录运行：
   ```bash
   npm install
   node server.js
   ```
3. 在浏览器中访问：http://localhost:3000
4. 点击"选择文件夹"按钮测试功能

## 功能特点

### 用户体验
- ✅ 直观的文件夹浏览界面
- ✅ 清晰的路径显示
- ✅ 响应式设计支持移动端
- ✅ 优雅的加载动画
- ✅ 键盘快捷键支持（ESC关闭）

### 技术特点
- ✅ 安全的路径处理
- ✅ 错误处理和用户反馈
- ✅ 支持所有Windows驱动器
- ✅ 过滤显示文件夹（隐藏文件）
- ✅ 支持长路径名称

### 兼容性
- ✅ Windows 系统优化
- ✅ 现代浏览器支持
- ✅ 移动端适配
- ✅ 高DPI屏幕支持

## 下一步扩展建议

1. **搜索功能**: 添加文件夹搜索
2. **收藏夹**: 保存常用文件夹路径
3. **预览**: 显示文件夹中图片数量
4. **拖拽支持**: 支持直接拖拽文件夹
5. **历史记录**: 记住最近选择的文件夹

这个实现提供了完整的文件夹选择和内容读取功能，用户体验友好，代码结构清晰，易于维护和扩展。
