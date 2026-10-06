# 时空列车 · Space Train Pixel

完全由 Three.js 场景合成界面的 TypeScript 像素／体素浏览器游戏垂直切片。原创切面列车、体素物品、可旋转空间库存，以及整备 → 自动探索 → 归仓 → 投料生产的可玩循环。

[在线试玩](https://iizzaya.github.io/space-train-pixel/) · [设计文档](docs/README.md) · [实现范围与测试参数](docs/pixel-slice.md)

## 本地运行

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
npm run preview
```

`dist/` 是独立静态产物。Vite 使用相对资源路径，支持 GitHub Pages 仓库子目录。字体、Three.js 和所有运行时资源随构建一起发布，不依赖 CDN。

## 操作

- 拖动物品到主仓库／背包的指定格位；绿色轮廓可放，红色表示碰撞或越界。
- 拖动中按 R 旋转，Esc、拖到外部、系统取消或窗口失焦安全取消。点击物品可以使用快捷转移／旋转／使用／装备按钮。
- 给土豆盆投入肥料，给滤水器投入塑料。机器独立存储产物，手动领取。
- 选择路线后自动经过 6 个节点。成功后手动回仓；失败时此次全部随身物品和装备丢失。
- 本机自动保存，重置有确认。页面隐藏、窗口失焦或菜单打开时暂停；没有离线生产。

## 结构

- `app/types.ts`、`app/engine.ts`：显式领域类型、纯规则、原子空间移动、生产／探索、v2 存档校验。
- `app/scene.ts`：原创程序化体素列车与物品模型。
- `app/renderer.ts`、`app/ui.ts`：单画布 Three.js HUD，网格、控件、日志、模态框、拖拽预览和纹理资源管理。
- `app/input.ts`、`app/main.ts`：逻辑坐标命中、指针事务、画布键盘焦点、时钟与持久化。
- `app/style.css`：仅页面与画布容器，无 HTML 游戏界面。
- `tests/`：44 项规则与输入测试，含 3,000 次种子化移动尝试。
- `docs/`：保留原始设计快照，新增[渲染架构](docs/rendering-architecture.md)与[验证范围](docs/verification.md)。

正常路径由单一 WebGLRenderer 合成全部游戏画面。无 WebGL 时，软件适配器读取相同的 Three.js 场景与 CanvasTexture，仍输出同一个画布，并明确标注兼容模式。HTML 只保留启动／图形错误说明。布局优先桌面与横屏平板，手机与完整屏幕阅读器体验尚未验收。

## 参考与素材

研究了 [project-3d-pixel](https://github.com/IIzzaya/project-3d-pixel) 的 Three.js、低分辨率画布和程序化体素方向。参考仓库未标注许可证，本项目没有复制其代码或资产。列车、场景、物品均为本项目原创程序化建模。字体 Press Start 2P 使用 SIL Open Font License；Three.js 使用 MIT，Vite 使用 MIT。许可证随构建产物一起发布于 `THIRD-PARTY-LICENSES.txt`。

这不是完整 MVP。未实现的已确认设计与暂定参数请看[范围说明](docs/pixel-slice.md)，不能从设计文档推定所有功能已完成。
