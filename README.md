# drone-overgrazing-detection

无人机过度放牧检测系统

## 项目简介
本项目旨在通过无人机拍摄的影像，结合深度学习目标检测模型，实现对牧场羊群数量的自动检测与过度放牧风险分析。系统集成了前端页面、后端服务、推理模型及相关数据处理脚本，支持图片上传、计数、裁图、拼图等功能。

## 主要功能
- 农户信息导入导出与管理
- 无人机影像上传与管理
- 羊群目标检测与数量统计
- 过度放牧风险分析
- 图片裁剪与拼接

## 安装与运行

### 依赖环境
- Node.js 16+
- Python 3.8+
- pip
- 推荐使用CUDA GPU环境以加速推理

### 安装步骤
1. 安装Node.js依赖
   ```bash
   npm install
   ```
2. 安装Python依赖
   ```bash
   pip install -r requirements.txt
   ```

3. 把"618数据yolo11x1920px.pt"放到yoloNumSheepNKY文件夹里

4. 启动后端服务
   ```bash
   npm start
   ```
5. 开始使用
   用浏览器打开`http:127.0.0.1:3000`页面

## 目录结构
```
├── config/           # 配置文件
├── database/         # 数据库及相关脚本
├── scripts/          # 前端JS脚本
├── server/           # Node.js后端服务
├── styles/           # 前端样式
├── yoloNumSheepBJUT/ # YOLO模型及推理脚本
├── yoloNumSheepNKY/  # 其他模型与脚本
├── *.html            # 前端页面
├── server.js         # 后端入口
└── README.md         # 项目说明
```

## 技术栈
- 前端：HTML/CSS/JavaScript
- 后端：Node.js (Express)
- 旋转框目标检测：YOLO11（Python）
- 数据库：SQLite

## 📝 TODO List
- [ ] 给每张照片增加一个裁图功能
- [ ] 增加拼图功能
- [x] ~~接入大疆智图的二维建图API~~（不接入了）
- [ ] 接入北工大计数
- [ ] 使用TensorRT加速计算
- [ ] 设置功能正常使用
