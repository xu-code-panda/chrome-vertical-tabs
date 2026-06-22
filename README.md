# 垂直标签页 Chrome 扩展

参考 [guokai.dev](https://guokai.dev/) 的 [Vertical Tabs in Side Panel](https://chromewebstore.google.com/detail/vertical-tabs-in-side-pan/akahnknmcbmgodngfjcflnaljdbhnlfo) 实现的 Chrome 侧边栏垂直标签页扩展。

## 功能特性

### 基础功能
- 在 Chrome 侧边栏（Side Panel）中垂直展示当前窗口的所有标签页
- 支持亮色 / 暗色主题（跟随系统）
- 底部搜索栏，可按标题和 URL 过滤标签页
- 支持 Chrome 原生标签组：折叠/展开、颜色标识、右键菜单
- 固定标签页单独分区显示
- 单击切换标签页，双击/中键关闭标签页
- 右键上下文菜单：重新加载、复制、固定、静音、关闭等
- 快捷键 `Alt+V` 打开侧边栏（可在 `chrome://extensions/shortcuts` 自定义）

### 拖拽功能
- **智能分组**：拖拽两个未分组的标签页到一起，自动创建新分组
- **三区域判断**：
  - 上方 30%：插入到目标标签页前面（排序）
  - 中间 40%：拖到一起创建/加入分组
  - 下方 30%：插入到目标标签页后面（排序）
- **分组内移动**：拖拽标签页到分组区域，轻松加入分组
- **分组外移出**：拖拽标签页到分组外，自动移出分组
- **视觉反馈**：拖拽时显示清晰的线条和框高亮指示

### 自定义设置
- 标签页间距调节
- 标签页字体和大小
- 拖拽指示器样式（线条粗细、颜色、分组框样式）
- 主题颜色自定义
- 分组颜色和样式

## 系统要求

- Google Chrome 114 及以上（需要 Side Panel API 支持）

## 安装方法

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本目录 `chrome-vertical-tabs`
5. 建议将扩展图标固定到工具栏，方便点击打开

## 使用方法

### 打开侧边栏

1. 点击工具栏上的扩展图标
2. 使用快捷键 `Alt+V`（macOS 同样为 Alt+V）
3. 点击浏览器侧边栏按钮，切换到「垂直标签页」

### 侧边栏位置

Chrome 设置 → 外观 → 侧边栏 → 选择显示在左侧或右侧

### 操作说明

| 操作 | 效果 |
|------|------|
| 单击 | 切换到该标签页 |
| 双击 | 关闭标签页 |
| 中键点击 | 关闭标签页 |
| 右键 | 打开上下文菜单 |
| 拖拽到标签页上方/下方 | 排序移动标签页 |
| 拖拽到标签页中间 | 创建分组或将标签页加入分组 |
| 拖拽到分组外 | 将标签页移出分组 |
| 点击分组标题 | 折叠/展开分组 |
| 底部搜索框 | 过滤标签页 |

## 项目结构

```
chrome-vertical-tabs/
├── manifest.json           # 扩展清单
├── background.js          # 后台服务：快捷键、点击图标打开侧边栏
├── icons/                 # 扩展图标
├── sidepanel/
│   ├── index.html         # 侧边栏页面
│   ├── sidepanel.css      # 样式（含暗色主题）
│   ├── sidepanel.js       # 标签页逻辑
│   ├── settings-page.js   # 设置页面逻辑
│   ├── theme-colors.js    # 主题颜色管理
│   ├── tab-layout.js      # 标签页布局管理
│   ├── tab-notes.js       # 标签页备注/标签
│   ├── background-image-layout.js  # 背景图片布局
│   └── background-image-editor.js # 背景图片编辑器
└── settings/
    ├── index.html         # 设置页面
    └── settings.css       # 设置页面样式
```

## 与 Chrome 原生垂直标签页的区别

Chrome 近期已推出原生垂直标签页功能。本扩展基于 Side Panel API，优势在于：

- 可与 Chrome 内置功能独立使用
- 提供搜索过滤、分组折叠记忆等增强功能
- **拖拽即分组**：拖拽两个标签页到一起即可自动创建分组，无需额外操作
- **智能位置判断**：三区域拖放，上下方排序，中间区域分组，操作直观
- **丰富的自定义选项**：可自定义拖拽指示器样式、主题颜色、分组样式等
- 界面风格参考 guokai.dev 的经典侧边栏体验

## 截图预览

> （建议添加截图展示扩展界面）

## 贡献与反馈

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
# chrome-vertical-tabs
# chrome-vertical-tabs
