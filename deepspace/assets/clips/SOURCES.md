# 官方完整陪伴与角色 PV 素材来源

这些素材来自叠桌面与《恋与深空》官方网站公开的动态壁纸和角色介绍视频，人物与宣传素材权利属于叠纸游戏及其权利人。本项目为个人非商业同人陪学作品，不代表官方授权。首次记录：2026-09-19；逐帧裁切复核与连续播放优化：2026-09-29。

## 默认：叠桌面完整陪伴（2026-09-29）

官方来源为[叠桌面官网](https://paperwall.papegames.com/)，由其公开、无需登录的[壁纸目录](https://desktop-api.papegames.com/v1/desktop/config)提供下载。目录内游戏为「恋与深空」，壁纸 ID 分别为 20、25；使用 1080 分辨率版本。未安装或执行官方客户端，也未提取游戏包内素材。

| 本地视频 | 官方标题与完整视频长度 | 原始下载 |
| --- | --- | --- |
| `qiyu-official-companion.mp4` | 祁煜·你的轮廓；1920×1080 / 30 fps，1090 帧，36.333333 秒。作画、停笔、看向你，再继续作画。 | [官方 MP4，37,965,681 字节](https://cmscdn.papegames.com/wallpaper/3b8b7200af9a261977154e0dd28f59b9.mp4) |
| `xinghui-official-companion.mp4` | 沈星回·午后浮光；1920×1080 / 30 fps，790 帧，26.333333 秒。低头阅读、抬眼回应，再低头。 | [官方 MP4，32,901,417 字节](https://cmscdn.papegames.com/wallpaper/8771cb2f5d6e6c06f9287ff924119515.mp4) |

全程固定机位，检查未见剪切或叠化；首尾姿态相近。完整保留每一帧和原速，未裁短、倒放、补帧、添加滤镜或生成动作。使用 FFmpeg 7.1 重编码 H.264 / yuv420p / CRF 18 / slow / 30 fps / 60 帧 GOP / faststart；去掉音轨与 timecode 数据流，沈星回因此不再包含超出最后视频帧的音轨余量。JPG 封面取第 0 帧。本地视频分别为 19,411,788 和 18,027,364 字节。

清单标记 `seamless: true`，使用同一个 HTMLVideoElement 的 `loop` 播放整个文件，不加载重复备用层、不进行循环叠化，也不因驻留时间自动切换。手动查看其他镜头仍可进行一次预解码切换。原生循环仍会重复官方的有限动作序列；不代表无限长的新表演。静音自动播放，网页环境音维持独立控制。

## 手动查看：角色 PV 片段

获取路径：官网 [首页](https://deepspace.papegames.com/home) 加载的公开角色组件 `941.js`，其 `B.qy` / `B.sxh` 为完整角色 PV，`w.qy` / `w.sxh` 为既有介绍循环。人物介绍：[祁煜](https://deepspace.papegames.com/news/4)、[沈星回](https://deepspace.papegames.com/news/2)。

| 本地视频 | 内容与原始时间范围 | 来源 |
| --- | --- | --- |
| `qiyu-original-gaze.mp4` | 画室正面眨眼，完整 95 帧 / 30 fps，约 3.17 秒。 | [官方介绍循环](https://assets.papegames.com/resources/cdn/20240624/6c5e58f3ca96defe.mp4) |
| `qiyu-window-painting.mp4` | 窗边高凳作画全景，源帧 [334,429)，11.133333–14.300000 秒。 | [祁煜官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/ui7ds8r5/qy_pv.mp4) |
| `qiyu-brush-pause.mp4` | 持笔思索、放低画笔，源帧 [777,886)，25.900000–29.533333 秒。 | [祁煜官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/ui7ds8r5/qy_pv.mp4) |
| `qiyu-quiet-glance.mp4` | 画室垂眸侧面近景，源帧 [1214,1323)，40.466667–44.100000 秒；去掉旧版开头混入的雕塑帧。 | [祁煜官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/ui7ds8r5/qy_pv.mp4) |
| `qiyu-back-desk.mp4` | 案前安静作画、末尾轻微转头，源帧 [1433,1564)，47.766667–52.133333 秒。 | [祁煜官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/ui7ds8r5/qy_pv.mp4) |
| `xinghui-original-gaze.mp4` | 书房正面注视，完整 120 帧 / 30 fps，4 秒。 | [官方介绍循环](https://assets.papegames.com/resources/cdn/20240624/ff40d89c1c0c31d0.mp4) |
| `xinghui-choose-record.mp4` | 透过唱片架挑选唱片，源帧 [285,375)，11.875000–15.625000 秒；排除下一镜的首帧。 | [沈星回官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/r14s05vu/st_pv.mp4) |
| `xinghui-afternoon-reading.mp4` | 倚坐读书、翻页、转头，源帧 [549,694)，22.875000–28.916667 秒；保留 PV 内两次柔和叠化，属于一组镜头。 | [沈星回官方角色 PV](https://assets.papegames.com/nikkiweb/papegame/deepspacecn/material/r14s05vu/st_pv.mp4) |

完整源 PV 仅用于本机筛选，未打包进项目。祁煜源视频为 1920×1080 / 30 fps / 72.23 秒；沈星回源视频为 3840×2160 / 24 fps / 46.5 秒。

所有范围均为从 0 起算的帧索引，包含起点、排除终点。使用 FFmpeg 7.1 的 `trim=start_frame=…:end_frame=…,setpts=PTS-STARTPTS` 精确裁切；两个原循环保留全部原始动作。全部重编码为 H.264 High / yuv420p / CRF 18 / slow，最高 1920×1080、显式 `-r 30` / `-r 24` 保留原帧率，1 秒 GOP，`+faststart` 前置 MP4 索引，去掉音轨。JPG 封面取导出片段 0.3 秒处。

保留原速、构图、色彩与原生 PV 字幕；没有倒放、补帧、人物生成或伪造新动作。字幕来自原宣传片，不是平台情境脚本中的角色发言。

以下旧 PV 片段保留两层预解码与短叠化，默认持续当前片段，用户手动下一镜；可点击「回到陪学」返回上面的完整官方镜头。可选的播放器自动模式使用 42–60 秒驻留时间，但不会自动离开完整陪学镜头；清单中的 `duration` 仍是真实素材长度，`dwellSeconds` 是循环驻留时间。由短片循环形成持续陪伴，并非新增了数十秒不重复的原生人物表演。持笔镜头的播放终点设为 2.9 秒、背案镜头设为 3.8 秒，避开尾部突然低头／转头造成的回环姿态跳变；完整源动作仍保留在文件中。切换角色、离开主页、后台与减少动态模式均会停止相应播放。

已检查源镜头首尾精确切点与导出首尾帧；所选片段不含其他男性角色、战斗、强闪光或付费素材。
