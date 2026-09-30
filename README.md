# 夏日奶茶铺 · 深空来信

[夏日奶茶铺](https://candy26i.github.io/clock_236/) · [深空来信](https://candy26i.github.io/clock_236/deepspace/)

奶茶铺首页以 2026-09-29 的 GitHub 版本（`22b2588`）为基础，顶部可切换两个空间。v68 按用户给出的截图恢复适度头身比和柔和立体插画质感，沈星回复用原 v65 系列、祁煜匹配同系列风格，沿用 v66 已校正的场景、桌面和点心位置；计时、金币、解锁与账户规则沿用原版。两边从 `shared/firebase-config.js` 读取同一个 Firebase 项目配置。

深空来信放在独立的 `deepspace/` 目录，包含祁煜 / 沈星回的 10 段动态陪伴、学习与科研任务、专注计时、分支剧情、对话、小游戏和回忆。返回链接会回到奶茶铺首页。

默认陪伴来自叠桌面的官方完整动态壁纸：祁煜《你的轮廓》36.333 秒，沈星回《午后浮光》26.333 秒。保留完整单机位动作，用同一视频元素原生循环，不叠化、不自动换镜。默认只载入当前角色的一支陪学视频；「其他镜头」手动查看保留的 PV 片段，「回到陪学」返回完整镜头。旧 PV 短片仍使用预解码叠化。素材仍是有限长度的官方动作循环，未生成新表演；读取清单不会重启正在播放的同源画面。

## 奶茶铺场景

12 类场景、20 个变体共用 `assets/milk-scene-layout-v66.*` 的承托面配置。人物位置、点心底部和杯底分别锚定；桌面图层按原背景同一缩放/裁切映射，遮住坐姿下半身。单人和串门保持相同场景高度，屋内地坐不添加坐垫。`assets/milk-characters-v68.js` 配合原有 sprite 样式显示参考风格的透明姿态图，保留原姿势菜单与互动逻辑；制作记录和提示词见 [参考风格角色说明](assets/characters/reference-v68/README.md)。

## 存档

- 两边的**已完成学习、科研时长互通**，继续使用项目 `milktea236-2c693` 和数据库根节点 `milktea-v1`。不用新建 Firebase，未更改数据库规则。
- 固定身份为 **Bedi / ljx → 祁煜 → `users/u1`**、**Zhai / zhai → 沈星回 → `users/u2`**。显示名字不作为数据库键，不会新建平行账户。日期沿用每个云账户现有的自定义时区。
- 深空「科研、写作」计入奶茶铺 `m.ky`，「学习」计入 `m.xx`；锻炼不计共同学习时间。奶茶铺的学习累计会显示在深空，并用于剧情解锁。奶茶资格和小料进度自然使用共享时长，同步本身不另发金币、星屑或羁绊。
- 深空任务、剧情选择、聊天、羁绊、星屑及进行中的计时仍保存在 `deepspace-companion-v1` 本机存档。两边正在运行的计时器独立；互通针对结算后的记录，不会自动合并两个独立计时器的重叠时段。
- 首次打开新版深空会补同步本机保存的已完成专注明细。同一记录在刷新、断网重试或导入另一设备后仅计一次。旧存档只保留最近 1000 条专注明细，超出部分的累计因缺少明细不会自动补账，页面会提示。
- 本地预览与 GitHub Pages 是不同的网站来源。把旧预览的进度带到线上时，先在旧深空来信的「设置」导出 JSON，再到线上「设置」导入。导入会替换该浏览器的深空存档，请先备份已有记录。
- 更换浏览器、设备、域名或清除网站数据时，请使用导出 / 导入迁移深空存档。

## 同步实现

`shared/study-ledger.js` 是纯记账逻辑；`deepspace/study-sync.js` 负责持久待同步队列、实时读取、离线缓存和重试。在单个 `milktea-v1/users/uN` 事务中同时增加 `days/<日期>/m` 和写入 `studySync/deepspaceSessions/<编码ID>` 收据，保留用户其他字段。收据按账户全局去重并长期保留，避免跨日或时区调整后重复入账；冲突时保留首次记录并提示。

显示总量 = 云端 `ky + xx` + 尚无收据的本机待同步记录，不能再直接叠加本机 `profile.minutes`。`deepspace-study-outbox-v1` 保存待同步项，`deepspace-study-cache-v1` 仅缓存日期累计、时区与收据；不缓存云端 Todo、奶茶和人物状态。事务重试遵循 [Firebase 官方事务说明](https://firebase.google.com/docs/database/web/read-and-write#save_data_as_transactions)。

## 发布与后续更新

当前仓库沿用 GitHub Pages 发布方式，首页仍是根目录 `index.html`。`deepspace/` 使用相对资源路径，适用于 `/clock_236/` 子路径。后续更新奶茶铺时保留首页的共享 Firebase 配置引用、`deepspace/portal.css` 引用和 `deepspace-portal` 导航，以及整个 `deepspace/`、`shared/` 目录。

本仓库不包含之前本地实验版的整套奶茶铺改造，也不包含 PMX 模型、模型纹理、3D 库或本地备份。v66 仅在当前 GitHub 奶茶铺基础上更新 2D 人物与场景承托。深空素材出处见 [素材说明](deepspace/assets/SOURCES.md) 与 [视频片段记录](deepspace/assets/clips/SOURCES.md)。

## 本地预览与验证

无需构建：在仓库目录运行 `python3 -m http.server 4189 --bind 127.0.0.1`，打开 `http://127.0.0.1:4189/`。

```sh
npm install
npm test
INTEGRATION_TEST_URL=http://127.0.0.1:4189/ npm run test:integration
COMPANION_TEST_URL=http://127.0.0.1:4189/deepspace/ npm run test:player
COMPANION_TEST_URL=http://127.0.0.1:4189/deepspace/ npm run test:native-player
npm run test:multitab
npm run test:sync
MILK_SCENES_TEST_URL=http://127.0.0.1:4189/clock_236/ npm run test:milk-scenes
```

浏览器验证使用 Playwright 和本机 Google Chrome；测试在隔离浏览器中拦截外部 HTTP 与 WebSocket，不连接真实 Firebase，不使用日常浏览器存档。

多标签页测试会自行启动临时本地服务器，验证另一页切换角色或修改进度后，人物、计时、任务和剧情同步显示。普通本页操作不会触发额外界面重建。

互通测试使用独立的模拟 Firebase；覆盖双向累计、两人隔离、原时区、剧情解锁、同 ID 去重、并发和离线重试。不会为验证功能向真实账户写入测试分钟。
