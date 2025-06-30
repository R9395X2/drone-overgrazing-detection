# 无人机过度放牧检测系统 - 可配置化指南

## 🎯 系统概述

本系统现已实现完全可配置化，允许您灵活地：
- 配置图片源目录
- 管理多个Python处理脚本
- 自定义处理选项和参数
- 动态启用/禁用功能模块

## 📁 系统架构

```
drone-overgrazing-detection/
├── config/                      # 配置系统
│   ├── config.json             # 主配置文件
│   └── ConfigManager.js        # 配置管理器
├── scripts/                     # 脚本和前端
│   ├── main.js                 # 前端主脚本
│   └── script_adapter.py       # Python脚本适配器
├── yoloNumSheepNKY/            # YOLO检测脚本
│   └── run.py                  # 原始YOLO脚本
├── index.html                   # 主页面
└── server.js                   # 后端服务器
```

## ⚙️ 配置系统

### 1. 主配置文件 (`config/config.json`)

```json
{
  "directories": {
    "default": "D:\\CYWRJGDFMJCXT",
    "alternatives": ["备用目录1", "备用目录2"]
  },
  "scripts": {
    "available": [
      {
        "id": "yolo_sheep_detection",
        "name": "YOLO羊群检测",
        "path": "./scripts/script_adapter.py",
        "description": "使用YOLO模型检测和计数羊群",
        "enabled": true,
        "type": "detection",
        "options": {
          "script_type": "yolo",
          "model": "yolo11x-obb.pt",
          "confidence": 0.5
        }
      }
    ]
  },
  "ui": {
    "defaultView": "grid",
    "autoLoadDirectory": true,
    "showProcessingOptions": true
  }
}
```

### 2. 配置管理器 (`config/ConfigManager.js`)

提供以下功能：
- ✅ 配置文件读取/写入
- ✅ 目录管理和验证
- ✅ 脚本配置管理
- ✅ 配置验证和报告
- ✅ 配置导入/导出

## 🐍 Python脚本集成

### 脚本适配器系统

所有Python脚本通过 `scripts/script_adapter.py` 统一调用：

```bash
# YOLO脚本调用
python script_adapter.py yolo /path/to/image.jpg '{"confidence": 0.5}'

# 自定义脚本调用
python script_adapter.py custom /path/to/image.jpg '{"script_path": "./custom.py"}'
```

### 支持的脚本类型

1. **YOLO检测脚本**
   - 自动调用现有的 `yoloNumSheepNKY/run.py`
   - 解析检测结果和计数信息
   - 返回标准化JSON格式

2. **自定义分析脚本**
   - 支持任意Python脚本
   - 统一输入/输出格式
   - 错误处理和超时控制

## 🔧 使用指南

### 1. 修改默认图片目录

编辑 `config/config.json`：
```json
{
  "directories": {
    "default": "您的图片目录路径"
  }
}
```

### 2. 添加新的Python脚本

在配置文件中添加脚本定义：
```json
{
  "id": "my_custom_script",
  "name": "我的自定义脚本",
  "path": "./scripts/script_adapter.py",
  "description": "自定义图片分析脚本",
  "enabled": true,
  "options": {
    "script_type": "custom",
    "script_path": "./my_script.py",
    "param1": "value1"
  }
}
```

### 3. 启用/禁用脚本

通过API或直接修改配置文件：
```javascript
// 通过API禁用脚本
fetch('/api/config/scripts/script_id/toggle', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({enabled: false})
});
```

## 🌐 API接口

### 配置管理API

- `GET /api/config` - 获取完整配置
- `POST /api/config` - 更新配置
- `GET /api/config/scripts` - 获取脚本配置
- `POST /api/config/scripts` - 更新脚本配置
- `POST /api/config/scripts/:id/toggle` - 启用/禁用脚本

### 图片处理API

- `GET /api/images/default` - 加载默认目录图片
- `POST /api/process-image` - 处理图片
- `GET /api/health` - 系统健康检查

## 🚀 启动系统

1. **启动后端服务器**
   ```bash
   node server.js
   ```

2. **访问Web界面**
   ```
   http://localhost:3000
   ```

3. **查看系统状态**
   ```
   http://localhost:3000/api/health
   ```

## 📊 系统特性

### ✅ 已实现功能

- [x] 可配置图片源目录
- [x] 多Python脚本管理
- [x] 统一脚本适配器
- [x] 配置文件热重载
- [x] 脚本执行状态监控
- [x] 错误处理和日志记录
- [x] 自动加载默认目录
- [x] 动态脚本选择界面

### 🔄 工作流程

```
用户打开网页 → 自动加载配置 → 
加载默认目录图片 → 用户点击图片 → 
显示可用脚本选项 → 用户选择脚本 → 
点击"开始处理" → 执行Python脚本 → 
显示处理结果和详情
```

## 🛠️ 开发指南

### 添加新的Python脚本

1. **创建Python脚本文件**
   ```python
   import sys
   import json
   
   def main():
       image_path = sys.argv[1]
       options = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
       
       # 处理图片逻辑
       result = {"processed": True, "data": "结果"}
       
       print(json.dumps(result))
   
   if __name__ == "__main__":
       main()
   ```

2. **在配置文件中注册脚本**
3. **重启服务器或重新加载配置**

### 修改前端界面

- 编辑 `scripts/main.js` 添加新功能
- 修改 `index.html` 调整界面布局
- 更新 `styles/main.css` 自定义样式

## 🔍 故障排除

### 常见问题

1. **图片目录无法访问**
   - 检查配置文件中的路径是否正确
   - 确认目录权限

2. **Python脚本执行失败**
   - 检查Python环境和依赖
   - 查看服务器日志获取详细错误信息

3. **配置文件格式错误**
   - 验证JSON格式是否正确
   - 使用配置验证API检查

### 日志查看

服务器日志会显示：
- 配置加载状态
- 脚本执行过程
- 错误信息和堆栈跟踪

## 📝 更新日志

### v2.0.0 - 可配置化版本
- ✨ 新增配置管理系统
- ✨ 实现Python脚本适配器
- ✨ 支持动态脚本管理
- ✨ 自动加载默认目录
- 🔧 重构前后端架构
- 📚 完善文档和示例

---

## 📞 技术支持

如有问题或建议，请查看：
- 系统日志文件
- API健康检查端点
- 配置验证报告

系统现已完全可配置化，您可以根据需要灵活调整各项设置！
