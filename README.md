# 夏日奶茶铺 · 深空来信

[夏日奶茶铺](https://candy26i.github.io/clock_236/) · [深空来信](https://candy26i.github.io/clock_236/deepspace/)

奶茶铺首页沿用 2026-09-29 的 GitHub 版本（`22b2588`），本次仅在顶部加入两个空间的导航。奶茶铺原有的计时、金币、场景、人物素材与 Firebase 配置保持不变。

深空来信放在独立的 `deepspace/` 目录，包含祁煜 / 沈星回的 7 段动态陪伴、学习与科研任务、专注计时、分支剧情、对话、小游戏和回忆。它不加载或修改奶茶铺的程序；返回链接会回到奶茶铺首页。

## 存档

- 奶茶铺继续使用现有 Firebase 项目 `milktea236-2c693` 和数据库根节点 `milktea-v1`。新增页面和更换 GitHub 仓库不需要另建 Firebase 项目；是否共享原记录取决于所用配置和数据库路径。本次未更改数据库规则或写入云端数据。
- 深空来信沿用独立本机存档 `deepspace-companion-v1`，**暂未接入 Firebase 云同步**；它的专注时长不会自动兑换奶茶铺的奖励。页面底部和设置中也明确说明本机保存。
- 本地预览与 GitHub Pages 是不同的网站来源。把旧预览的进度带到线上时，先在旧深空来信的「设置」导出 JSON，再到线上「设置」导入。导入会替换该浏览器的深空存档，请先备份已有记录。
- 更换浏览器、设备、域名或清除网站数据时，请使用导出 / 导入迁移深空存档。

## 发布与后续更新

当前仓库沿用 GitHub Pages 发布方式，首页仍是根目录 `index.html`。`deepspace/` 使用相对资源路径，适用于 `/clock_236/` 子路径。后续更新奶茶铺时保留首页的 `deepspace/portal.css` 引用和 `deepspace-portal` 导航，以及整个 `deepspace/` 目录即可。

本次不包含之前本地实验版的奶茶铺改造，也不包含 PMX 模型、模型纹理、3D 库或本地备份。深空素材出处见 [素材说明](deepspace/assets/SOURCES.md) 与 [视频片段记录](deepspace/assets/clips/SOURCES.md)。

## 本地预览与验证

无需构建：在仓库目录运行 `python3 -m http.server 4189 --bind 127.0.0.1`，打开 `http://127.0.0.1:4189/`。

```sh
npm install
npm test
INTEGRATION_TEST_URL=http://127.0.0.1:4189/ npm run test:integration
COMPANION_TEST_URL=http://127.0.0.1:4189/deepspace/ npm run test:player
npm run test:multitab
```

浏览器验证使用 Playwright 和本机 Google Chrome；测试在隔离浏览器中拦截外部 HTTP 与 WebSocket，不连接真实 Firebase，不使用日常浏览器存档。

多标签页测试会自行启动临时本地服务器，验证另一页切换角色或修改进度后，人物、计时、任务和剧情同步显示。普通本页操作不会触发额外界面重建。
