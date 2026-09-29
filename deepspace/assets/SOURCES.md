# 素材来源与使用说明

人物、形象及官方宣传素材属于《恋与深空》及其权利人叠纸游戏（Papergames）。本项目为非官方、非商业的个人同人陪学作品，与官方无隶属或授权关系；本记录不代表素材获得了另行授权。游戏剧情与本项目原创陪学互动应明确区分。

这些素材于 2026-09-19 从[《恋与深空》官方网站](https://deepspace.papegames.com/home)公开发布的页面、角色介绍组件与官方 CDN 获取，未使用登录、游戏客户端提取或私有接口。下表列出的图片与原始循环保持官方文件原样；新增 PV 片段的裁切记录另列于文末。人物身份均已目视核对。

官方人物介绍：[祁煜](https://deepspace.papegames.com/news/4)、[沈星回](https://deepspace.papegames.com/news/2)。

| 本地文件 | 内容 | 官方原始地址 |
| --- | --- | --- |
| `qiyu-scene.jpg` | 祁煜，画室白衬衫近景；1920×969。 | [官方 CDN](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/ccdxhauc/screen2QY.jpg) |
| `qiyu-portrait.jpg` | 祁煜，画板与铅笔竖版角色图；780×1692。 | [官方 CDN](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/x6eihw3q/bg-1.jpg) |
| `xinghui-scene.jpg` | 沈星回，暖色书房白色帽衫近景；1920×969。 | [官方 CDN](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/xcyd4mxg/screen2SXH.jpg) |
| `xinghui-portrait.jpg` | 沈星回，浅色猎人制服竖版角色图；780×1692。 | [官方 CDN](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/ri87k1-o/bg-2.jpg) |
| `qiyu-card.png` | 祁煜·夜海完整思念卡面；1139×718，包含卡框和文字，并非透明人物立绘。 | [官方 CDN](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/3_uocmr8/qy.png) |
| `xinghui-card.png` | 沈星回·微光懒阳完整思念卡面；1139×718，包含卡框和文字，并非透明人物立绘。 | [官方 CDN](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/43rmrfj-/sxh.png) |
| `clips/qiyu-original-gaze.mp4` | 祁煜官网人物介绍背景动态视频；1920×968，约 3.17 秒，5.20 MB。 | [官方 CDN](https://assets.papegames.com/resources/cdn/20240624/6c5e58f3ca96defe.mp4) |
| `clips/xinghui-original-gaze.mp4` | 沈星回官网人物介绍背景动态视频；1920×968，4 秒，5.14 MB。 | [官方 CDN](https://assets.papegames.com/resources/cdn/20240624/ff40d89c1c0c31d0.mp4) |

官网首页 banner 数据提供场景与竖版图片；首页公开的思念展示组件提供两张卡面；角色介绍组件提供短视频。场景 JPG 可作为同角色视频的加载失败回退图片。

两个原始循环保存在 `clips/` 中，由播放器兜底与轮播共用，避免重复存储。

两个 MP4 已由 macOS AVFoundation 成功解码并抽帧核验：祁煜在画室眨眼，沈星回在暖色书房直视镜头。视频为官方预制动作，不能代表实时 3D 模型或自由动作生成。

## 此刻相伴：7 段真实 PV 动态

`clips/manifest.json` 提供祁煜 4 段、沈星回 3 段视频及对应封面，包含上表两个原循环和五段不同的官方角色 PV 镜头：窗边作画、持笔思索、垂眸、选唱片与倚坐翻书。新增片段为原速静音裁切，最高 1920×1080，未变速、倒放或生成新动作；原片底部字幕保留。每段的原始地址、时间码和验证记录见 [clips/SOURCES.md](clips/SOURCES.md)。
