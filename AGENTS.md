# AGENTS.md

Chrome 扩展（Manifest V3），零构建依赖，纯 JavaScript + HTML + CSS。

## 开发

无需 npm/Node。直接编辑 `extension/` 下的文件，在 `chrome://extensions/` 加载 `extension/` 目录。

**热更新**：改 background.js → 扩展页刷新；改 content-*.js/content.css → 刷新目标网页；改 popup.* → 关弹窗重开；改 manifest.json → 扩展页刷新。

## 架构

四大模块通过 `chrome.runtime.sendMessage` + `chrome.storage.sync` 通信：

```
content-*.js ←→ background.js ←→ popup.js
                                ↕
                          exclusions.js
                          strategies.js
```

### content script（6 个文件，严格按此顺序加载）

`extension/manifest.json` 中 `content_scripts[0].js` 数组定义了加载顺序，`content.js` 必须在最后。共享全局状态声明在 `content-core.js`。

| 文件 | 职责 |
|------|------|
| `naming.js` | 文件名模板渲染（共享模块，也用于 popup） |
| `content-core.js` | DEBUG 开关、CONFIG、共享状态（hoverTimer, currentImage 等）|
| `content-strategies.js` | URL 转换策略匹配（findMatchingStrategy 等）|
| `content-image-processing.js` | WebP 转换、Canvas 提取、图像处理 |
| `content-download.js` | 下载按钮点击处理、多路径回退 |
| `content-ui.js` | 按钮 DOM 创建/定位/销毁 |
| `content.js` | 入口：设置初始化、消息路由、hover 事件、storage 监听器 **（必须最后加载）** |

### popup（4 个文件，按顺序加载）

`popup.html` 中 `<script>` 顺序：`jszip.min.js` → `naming.js` → `popup-config.js` → `popup-i18n.js` → `popup.js`。

### 版本号

发布新版本时需同步更新 **4 处**（注意各文件可能不同步）：

1. `extension/manifest.json` → `"version"`
2. `extension/popup-config.js` → `EXTENSION_VERSION`
3. `extension/strategies.js` → `EXTENSION_VERSION`
4. `extension/exclusions.js` → `EXTENSION_VERSION`

当前（2026-06）：manifest 为 1.6.5，但 strategies.js 和 exclusions.js 可能落后。

## 约定

- **代码风格**：classic script 共享全局作用域（`<script>` 标签引入），不使用 ES modules。变量通过 `let`/`const`/`function` 在顶层定义跨文件可见。
- **文件名清洗**：`naming.js` 的 `sanitizeFilenameSafe()` 限制 100 字符，`renderTemplate()` 自动补 `{ext}`。
- **下载按钮 z-index**：`2147483647`（Chrome 最大值）。
- **all_frames: true**：内容脚本注入所有 frame（包括 iframe）。
- **WebP 处理**：保守策略，只转换静态图，无法判定时跳过。
- **storage 键名前缀**：`ih_`（如 `ih_enabled`、`ih_hover_delay`），`chrome.storage.sync` 存储。完整键名见 `docs/architecture-report.md` 第 9 节（可能略旧）。
- **国际化**：使用 `_locales/{en,zh_CN}/messages.json`，manifest 中通过 `__MSG_key__` 引用，popup 中运行时替换 `data-i18n` 属性。

## 调试

每个 JS 文件顶部有独立 `DEBUG = false` 常量。改为 `true` 开启控制台日志，各有前缀：
- `[IH]`（background / popup-config）
- `[IH Content]`（content-core）
- `[IH Strategies]`（strategies）
- `naming.js` 独立开关 `IH_NAMING_DEBUG`

## 测试

无自动化测试。手动测试：在浏览器打开 `test/webp-conversion-test.html` 测试 WebP 转换。
