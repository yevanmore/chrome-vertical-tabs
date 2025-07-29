# 🏷️ Chrome标签页优先级管理器

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/username/tab-priority-manager)

一个强大的Chrome浏览器扩展，帮助你智能管理浏览器标签页，支持优先级分类和访问统计。

[功能演示](#-功能演示) • [安装方法](#-安装方法) • [使用指南](#-使用指南) • [开发文档](#-开发文档)

</div>

## ✨ 功能特性

### 🎯 智能标签管理
- **🔥 常驻标签**：重要工作标签，支持快速切换
- **📁 已收纳标签**：临时或不常用标签，可批量清理
- **🔄 自动分类**：新标签自动归类为已收纳

### 📊 访问统计与排序
- **📈 访问计数**：自动记录每个标签页的访问次数
- **🔢 智能排序**：根据访问频率自动排序，重要页面优先显示
- **📍 视觉指示器**：
  - 标签页标题显示访问次数指示器
  - popup中显示详细的访问统计
  - 页面右下角实时显示当前访问计数

### ⌨️ 快捷键操作
- `⌘+1` / `Ctrl+1`：标记当前标签为常驻
- `⌘+3` / `Ctrl+3`：标记当前标签为已收纳  
- `⌘+D` / `Alt+D`：在常驻标签间快速切换

#### 🎨 直观的用户界面
- **标签页标题**：显示优先级图标和访问次数指示器
- **popup面板**：分类显示所有标签，支持拖拽排序
- **页面指示器**：右下角显示当前页面访问计数
- **批量操作**：一键清理已收纳标签

## 📸 功能演示

### 访问计数指示器
```
1-5次访问:   🔥●●● 页面标题
6-10次访问:  🔥●●●●●🔘🔘 页面标题  
11-20次访问: 🔥●●●[15] 页面标题
20+次访问:   🔥⚡[25] 页面标题
```

### Popup界面预览
- 常驻标签：显示访问次数最多的重要页面
- 已收纳标签：按访问频率排序的其他页面
- 每个标签显示对应数量的视觉指示器

## 🚀 安装方法

### 方法一：Chrome Web Store (推荐)
> 🚧 正在提交到Chrome Web Store，敬请期待

### 方法二：开发者模式安装
1. **下载扩展**
   ```bash
   git clone https://github.com/username/tab-priority-manager.git
   cd tab-priority-manager
   ```

2. **安装到Chrome**
   - 打开Chrome浏览器
   - 访问 `chrome://extensions/`
   - 开启右上角的"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目文件夹
   - 扩展安装完成！

## 📖 使用指南

### 基本操作
1. **标记标签优先级**
   - `⌘+1`：标记为常驻标签
   - `⌘+3`：标记为已收纳标签

2. **快速切换**
   - `⌘+D`：在常驻标签间循环切换
   - 点击扩展图标查看所有标签

3. **管理标签**
   - 在popup中点击标签名称快速切换
   - 使用🔥和📁按钮调整优先级
   - 点击"清理已收纳标签"批量关闭

### 高级功能
- **访问统计**：每次切换到标签页自动增加计数
- **智能排序**：根据访问频率自动排序标签
- **视觉指示器**：标签页标题显示访问次数

## 🛠️ 开发文档

### 技术架构
- **Manifest V3**：使用最新的Chrome扩展API标准
- **Service Worker**：后台处理标签管理和访问统计
- **Content Scripts**：页面内显示访问计数和优先级指示器
- **Chrome APIs**：
  - `chrome.tabs`：标签页操作和监听
  - `chrome.storage`：持久化标签状态和访问计数
  - `chrome.commands`：全局快捷键处理

### 项目结构
```
tab-priority-manager/
├── manifest.json          # 扩展配置文件
├── background.js          # 后台服务脚本
├── popup.html             # 弹窗界面
├── popup.js              # 弹窗逻辑
├── content.js            # 内容脚本
├── content.css           # 内容样式
└── README.md             # 项目文档
```

### 核心功能实现

#### 访问计数系统
- 监听 `chrome.tabs.onActivated` 事件记录标签访问
- 使用 `chrome.storage.local` 持久化访问计数
- 实时更新标签页标题和popup显示

#### 优先级管理
- 二级优先级系统：常驻(1) 和 已收纳(3)
- 支持快捷键快速标记和切换
- 智能排序：按访问频率降序排列

#### 视觉指示器
- 标签页标题动态显示访问次数
- popup中显示对应数量的圆点指示器
- 页面右下角实时计数显示

### 权限说明
- **tabs**：读取和操作浏览器标签页
- **storage**：保存标签优先级和访问统计
- **activeTab**：获取当前活动标签信息

### 本地开发
1. **克隆仓库**
   ```bash
   git clone https://github.com/username/tab-priority-manager.git
   cd tab-priority-manager
   ```

2. **加载扩展**
   - Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展程序

3. **调试功能**
   - 在任意页面控制台运行 `extensionDebug.showAccessCounts()`
   - 查看后台页面：`chrome://extensions/` → 查看视图 → 背景页

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交 Issue
- 🐛 Bug报告：请详细描述重现步骤
- 💡 功能建议：说明使用场景和预期效果
- ❓ 使用问题：提供操作系统和浏览器版本

### 开发规范
- 遵循现有代码风格
- 添加必要的注释和文档
- 测试新功能的兼容性

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

感谢所有为这个项目贡献代码和建议的开发者！

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个Star支持！**

[报告Bug](https://github.com/username/tab-priority-manager/issues) • [功能建议](https://github.com/username/tab-priority-manager/issues) • [交流讨论](https://github.com/username/tab-priority-manager/discussions)

</div>

### 文件结构
```
├── manifest.json      # 插件配置文件
├── background.js      # 后台服务脚本
├── popup.html         # 弹出界面HTML
├── popup.js          # 弹出界面逻辑
├── content.js        # 内容脚本
├── content.css       # 内容脚本样式
└── README.md         # 说明文档
```

### 核心类
- `TabPriorityManager`：标签优先级管理核心类
- `PopupManager`：弹出界面管理类
- `TabContentManager`：页面内容管理类

## 更新日志

### v1.0.0
- 初始版本发布
- 支持三级优先级标签管理
- 实现快捷键操作
- 添加可视化管理界面
- 支持批量操作

## 贡献

欢迎提交Issue和Pull Request来改进这个插件！

## 许可证

MIT License