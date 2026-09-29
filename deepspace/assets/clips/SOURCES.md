# 官方角色 PV 陪伴片段来源

这些素材来自《恋与深空》官方网站公开的角色介绍视频，人物与宣传素材权利属于叠纸游戏及其权利人。本项目为个人非商业同人陪学作品，不代表官方授权。记录日期：2026-09-19。

获取路径：官网 [首页](https://deepspace.papegames.com/home) 加载的公开角色组件 `941.js`，其 `B.qy` / `B.sxh` 为完整角色 PV，`w.qy` / `w.sxh` 为既有介绍循环。人物介绍：[祁煜](https://deepspace.papegames.com/news/4)、[沈星回](https://deepspace.papegames.com/news/2)。

| 本地视频 | 内容与原始时间范围 | 来源 |
| --- | --- | --- |
| `qiyu-original-gaze.mp4` | 既有祁煜画室正面眨眼循环，约 3.17 秒；原文件复制。 | [官方介绍循环](https://assets.papegames.com/resources/cdn/20240624/6c5e58f3ca96defe.mp4) |
| `qiyu-window-painting.mp4` | 白衬衫祁煜在窗边高凳上作画的全景，11.35–14.25 秒。 | [祁煜官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/ui7ds8r5/qy_pv.mp4) |
| `qiyu-brush-pause.mp4` | 祁煜持画笔思索、放低画笔的中近景，25.90–28.70 秒。 | [祁煜官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/ui7ds8r5/qy_pv.mp4) |
| `qiyu-quiet-glance.mp4` | 祁煜在海边画室垂眸的侧面近景，40.45–43.75 秒。 | [祁煜官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/ui7ds8r5/qy_pv.mp4) |
| `xinghui-original-gaze.mp4` | 既有沈星回书房正面注视循环，4 秒；原文件复制。 | [官方介绍循环](https://assets.papegames.com/resources/cdn/20240624/ff40d89c1c0c31d0.mp4) |
| `xinghui-choose-record.mp4` | 白色帽衫沈星回透过唱片架挑选唱片，11.90–15.65 秒。 | [沈星回官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/r14s05vu/st_pv.mp4) |
| `xinghui-afternoon-reading.mp4` | 沈星回倚坐读书、手指翻页和微微转头，22.875–28.75 秒；保留 PV 内两次柔和叠化。 | [沈星回官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/r14s05vu/st_pv.mp4) |

完整源 PV 仅用于本机筛选，未打包进项目。祁煜源视频为 1920×1080 / 30 fps / 72.23 秒；沈星回源视频为 3840×2160 / 24 fps / 46.5 秒。

新增五段通过 macOS AVFoundation 按上述原始时间码裁切为静音 MP4、最高 1920×1080，保留原速、构图、色彩与底部原生 PV 字幕。没有变速、倒放、补帧、人物生成或伪造新动作。字幕属于原宣传片，不能被视作本平台情境脚本的角色发言。JPG 封面直接来自对应视频抽帧。

已逐半秒检查候选范围，并对导出片段的开头、中间和末尾抽帧复核角色与内容。所选片段不含其他男性角色、战斗、强闪光或付费素材。祁煜三段新增镜头与沈星回两段新增镜头均与原有正面循环不同。`manifest.json` 中的时长取导出文件的实际时长，可能因帧边界有少量差异。
