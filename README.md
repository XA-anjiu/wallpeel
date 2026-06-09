<p align="center">
  <img src="docs/banner.png" alt="Wallpeel — Unleash your Wallpaper Engine" width="100%">
</p>

<div align="center">

# Wallpeel

**你的壁纸，不止于壁纸。**

Wallpaper Engine 壁纸资源提取工具。<br/>
自动识别、批量提取、轻松管理 — 让每一份创意都触手可及。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/XA-anjiu/wallpeel?style=flat)](https://github.com/XA-anjiu/wallpeel/stargazers)

[下载](#-快速开始) · [使用说明](#-使用说明) · [反馈问题](https://github.com/XA-anjiu/wallpeel/issues)

</div>

---

## Wallpeel 是什么？

Wallpeel 让你轻松提取 Wallpaper Engine 的壁纸资源。不管是视频壁纸还是场景壁纸，只需一键，就能把喜欢的素材保存到本地。

告别手动翻找文件夹的日子。Wallpeel 自动扫描 Steam 库，智能识别壁纸类型，批量提取视频、图片等资源。你的创意库，从此井井有条。

---

## ✨ 功能特性

- 🔍 **自动搜索** - 启动时自动检测 Steam 库中的 Wallpaper Engine 壁纸目录
- 📦 **PKG 提取** - 解包场景壁纸，提取纹理图片（TEX → PNG）
- 🎬 **MPKG 提取** - 解包视频壁纸，提取 MP4 视频文件
- 🖼️ **壁纸预览** - 网格展示所有壁纸，支持预览图加载
- 📁 **批量操作** - 多选壁纸，一键复制/提取
- 🌙 **暗色主题** - 支持亮色/暗色主题切换
- 🖱️ **右键菜单** - 快速查看详情、打开目录、复制预览图
- ⚙️ **全局设置** - 统一配置输出路径、自动清理等

---

## 📸 截图

<!-- TODO: 添加截图 -->
<!-- ![主界面 - 亮色模式](docs/screenshots/main-light.png) -->
<!-- ![主界面 - 暗色模式](docs/screenshots/main-dark.png) -->
<!-- ![右键菜单](docs/screenshots/context-menu.png) -->
<!-- ![MPKG 管理器](docs/screenshots/mpkg-manager.png) -->
<!-- ![详情面板](docs/screenshots/detail-panel.png) -->
<!-- ![设置面板](docs/screenshots/settings.png) -->

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 打包为安装程序

```bash
npm run dist
```

---

## 📁 项目结构

```
wallpeel/
├── electron/                # Electron 主进程
│   ├── main.cjs            # 主进程逻辑
│   └── preload.cjs         # 预加载脚本
├── src/                     # React 前端
│   ├── App.tsx             # 主组件
│   ├── lib/
│   │   ├── extractor.ts    # MPKG 解析器
│   │   └── repkg-wrapper.ts
│   └── index.css           # 样式
├── tools/
│   └── RePKG.exe           # PKG 解析工具
├── package.json
└── vite.config.ts
```

---

## 🛠️ 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS 4
- **桌面框架**: Electron
- **构建工具**: Vite
- **图标**: Lucide React
- **PKG 解析**: RePKG.exe (C#)
- **MPKG 解析**: Node.js 原生实现

---

## 📖 使用说明

### 1. 首次启动

应用会自动搜索 Steam 库中的 Wallpaper Engine 壁纸目录。如果没有找到，可以在设置中手动选择。

### 2. 浏览壁纸

所有壁纸会以网格形式展示，支持：
- 按类型过滤（视频/场景）
- 搜索壁纸名称或标签
- 预览图懒加载

### 3. 提取资源

**单个提取：**
1. 点击壁纸卡片，打开详情面板
2. 点击「开始提取」
3. 提取完成后查看结果

**批量提取：**
1. 点击「多选」进入多选模式
2. 勾选需要提取的壁纸
3. 点击「复制 MP4」或「提取 PKG」

### 4. MPKG 管理

对于从其他渠道下载的 MPKG 文件：
1. 点击「MPKG」按钮打开管理器
2. 选择 MPKG 文件所在目录
3. 点击「扫描」匹配本地壁纸
4. 选择文件后点击「解压并提取」

---

## ⚙️ 配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 壁纸目录 | Wallpaper Engine 创意工坊路径 | 自动搜索 |
| 输出路径 | 提取文件的复制目标 | 桌面/Wallpeel_Output |
| 标题字体 | 标题显示字体 | Lora |
| 删除冗余文件 | 解压后清理非媒体文件 | 关闭 |

---

## 🐛 已知问题

- GIF 预览图复制到剪贴板会变成静态图（系统限制）
- 部分壁纸可能缺少预览图

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- [RePKG](https://github.com/notscuffed/repkg) - PKG 格式解析工具
- [unmpkg](https://github.com/aqnya/unmpkg) - MPKG 格式参考
