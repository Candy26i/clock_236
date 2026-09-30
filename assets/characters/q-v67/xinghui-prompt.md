# 沈星回 Q-v67 八姿态图集

- 生成方式：内置 `image_gen`，一次生成 + 一次针对头身比例的编辑；未使用 CLI、脚本图像后处理或像素修改。
- 成品：`xinghui-study-sheet.png`，1536 × 1024，RGBA。
- 初次生成：`/Users/madili/.codex/generated_images/01a0baee-767d-7c60-911b-f22a967a7c77/exec-9dad6e3f-9054-457f-b4d6-4260f8acfaa0.png`。
- 最终工具输出：`/Users/madili/.codex/generated_images/01a0baee-767d-7c60-911b-f22a967a7c77/exec-6eac6552-12a5-4b16-8260-690692e351b8.png`。项目文件为此原 PNG 的直接副本。
- 针对编辑参考：`assets/characters/q-v67/qiyu-study-sheet.png`，统一头身和柔和体积插画质感，保留沈星回自己的发色、蓝眼、表情与服装。
- 参考：`assets/characters/shenxinghui-v65-default.png`、`assets/characters/shenxinghui-v65-chair-read.png`（Q版画风、服装）；`deepspace/assets/xinghui-portrait.jpg`（身份与脸部特征）。
- 非官方 AI 辅助角色插画；并非游戏官方原画或真实 3D 模型。

## 只读检查

维持原版柔和 Q 版立体插画质感。初稿目标约 3.3 头身；根据祁煜新图的实际比例，集成负责人要求改为约 2.6 头身以统一两人，最终版头部明显增大、身体缩短。八个姿态保持银白碎发、可见蓝眼、奶白浅蓝开衫、吊坠、灰裤与白蓝鞋。八个 alpha>20 主体连通域均互不接触。椅坐姿在最终编辑中随祁煜参考改为一腿搭另一腿的放松坐姿，书/平板/电脑姿态对应不变。

**布局限制：** 图集视觉排列为四列两行，但生成器没有严格遵守提示词的 64px 透明行间隔或等分单元。上下排主体最近间隔约 16px；上排最下延伸至 y=519。侧卧主体左缘为 x=1124，越过标准第四列 x=1152。集成应使用以下自定义裁切区域，不能直接按 384×512 等格截取。本文件如实保留原输出，没有用脚本挪图或缩图。

以下 bbox 为 alpha>20 的主体半开边界 (left, top, right, bottom)，含设备及椅子；抗锯齿边缘建议保留 3–5px 余量：

| 顺序 | 姿态 | bbox | 主体像素数 |
| --- | --- | --- | ---: |
| 1 | 站立手插兜 | [85, 44, 324, 518) | 67,954 |
| 2 | 地面盘腿读书 | [447, 113, 722, 517) | 71,804 |
| 3 | 地面盘腿耳机平板 | [824, 121, 1091, 519) | 74,400 |
| 4 | 地面盘腿电脑 | [1210, 117, 1479, 518) | 72,621 |
| 5 | 椅坐读书 | [93, 534, 373, 987) | 72,162 |
| 6 | 椅坐耳机平板 | [468, 540, 742, 987) | 72,617 |
| 7 | 椅坐电脑 | [818, 541, 1102, 985) | 72,609 |
| 8 | 侧卧枕手 | [1124, 714, 1519, 967) | 58,932 |

alpha=0 像素占 59.274%，最大 alpha=254。背景抽样 (0,0)、(384,400)、(768,400)、(1130,400)、(20,900)、(760,900) 均为 alpha=0。图像工具预览可能显示透明像素中保留的 RGB 雾色，实际不代表不透明背景。alpha1–20 有淡边缘与噪点，推荐按上述主体边界裁切。alpha>20 的八大主体外仅有 9 个零星像素。以上分析只读取图像数据，未编辑原图。

## 完整提示词

```text
Use case: stylized-concept. Create ONE production transparent PNG sprite atlas of Shen Xinghui / Xavier from Love and Deepspace, in the refined Q-version illustration style of reference images 1 and 2.
Canvas exactly 1536 x 1024, landscape 3:2. Exactly FOUR columns and TWO rows, EIGHT separate complete characters, one per cell. No text or grid lines.

REFERENCE ROLES:
Image 1 shenxinghui-v65-default.png and image 2 shenxinghui-v65-chair-read.png define the desired Q-style, face character, outfit, delicate shading, and soft three-dimensional ILLUSTRATION volume. Keep this charming small companion aesthetic. Image 3 xinghui-portrait.jpg defines recognizable facial identity and silver hair/blue eyes only; do NOT copy its realistic adult body, uniform, or background.
Refine the identity toward Shen Xinghui: fine silver-gray layered wispy strands with a COMPACT hair cap, clear visible muted blue irises, softly sculpted oval face with a slight chin, calm gently sleepy eyelids, small closed mouth with a subtle neutral tender expression. Quiet, reliable, composed. Same head, hair, face, eye color, proportions and outfit in all 8 poses.

STYLE: polished delicately hand-painted Q character with soft volume and clean gentle shading, like the first two reference illustrations. Approximately 3.3 HEADS TALL in standing anatomy. NOT a baby, NOT a toddler, NOT a 2-head mascot, NOT a long seven-head adult. Preserve character recognizability: slightly elongated soft face rather than a round baby face, restrained eyes rather than gigantic saucer eyes. Silver fine strands rather than huge fluffy marshmallow hair. Refined illustrated fabric texture and tiny natural hand details; no thick black outlines, no realistic skin pores, no oil painting, no plastic toy or glossy 3D render.
Outfit in EVERY pose: cream knit cardigan with subtle pale-blue trim, plain white shirt, slim silver necklace/pendant, soft light-gray trousers, clean white and pale-blue sneakers. Match the reference outfit. No alternate costumes.
All eyes remain at least partly open with BLUE irises visibly readable. For book/tablet/laptop poses, head only gently angled downward, eyes visible; never hide the whole face behind hair or a device.

Exact order left to right:
TOP ROW:
1) Standing calmly with both hands in pockets, both feet visible.
2) Sitting cross-legged directly on invisible ground, holding and reading an open book on lap. NO cushion or mat.
3) Sitting cross-legged directly on invisible ground, wearing soft white over-ear headphones and holding a tablet naturally.
4) Sitting cross-legged directly on invisible ground, typing on a complete small open laptop resting on lap.
BOTTOM ROW:
5) Sitting on a simple warm-gray chair, reading an open book, both shoes resting down; complete chair and legs.
6) Sitting on the SAME warm-gray chair, white over-ear headphones, holding tablet, both shoes down.
7) Sitting on the SAME warm-gray chair, small laptop on lap, both shoes down.
8) Resting low on his side with bent legs, head supported by one hand and elbow, calm open sleepy blue eyes. No pillow, bed, mat or cushion. Keep the FULL body and both shoes in the last cell.

STRICT SPRITE LAYOUT: Eight whole, fully isolated character silhouettes with a minimum 64-pixel TRANSPARENT GAP between all neighboring sprites. Each grid cell is 384 x 512. Generous empty margins: top-row figures fit within y=40..464, bottom-row figures within y=560..984. Each column's allowed x range is respectively 32..352, 416..736, 800..1120, 1184..1504. Thus 64px transparent vertical gutters must remain empty. No hair, hand, shoe, prop or chair leg may cross these regions. Center each figure within its own column. Approximately consistent head size across poses, about 110-125px tall; standing figure about 390-415px tall. Sitting figures naturally shorter. Scale the reclined pose modestly if needed so it stays complete within its 320px-wide allowed region. This must be a carefully spaced atlas, not a crowded character collage. All shoes, devices, hair tips and chair legs visible and intact.

TRANSPARENCY: A genuine RGBA PNG with alpha=0 for ALL non-character areas. No background, paper, wall, vignette, ground, floor, pedestal, base plate, drop shadow, halo, mist, glow, sparkles, painted checkerboard or environmental objects. Transparent holes between chair legs and between limbs. Clean anti-aliased edges only. The only visible things are the eight characters, their held devices/books/headphones, and exactly three chairs.
No logos, captions, labels or watermarks.
```

## 针对头身统一的编辑提示词（完整）

```text
Use case: precise-object-edit / character proportion matching.
Image 1 is the exact Qiyu chibi sprite atlas STYLE AND PROPORTION REFERENCE.
Image 2 is the SHEN XINGHUI eight-pose atlas to EDIT.

Edit Image 2 only. Make Shen Xinghui match Image 1's EXACT head-to-body proportion and soft refined illustration rendering. The present Shen Xinghui is visibly too tall and long-bodied. Enlarge each head and shorten the torso and legs so standing anatomy is approximately 2.6 HEADS TALL, matching the compact Qiyu reference. Use the same visual head size/body scale as the corresponding Qiyu poses; do not merely scale down the entire current sprite. Preserve natural chibi hands and good anatomy. Match Qiyu's delicate softly volumetric illustration finish, not a real 3D model.

Keep Shen Xinghui's silver-white compact finely layered hair, calm blue eyes, soft slightly tapered face, tiny closed neutral mouth and quietly sleepy reliable expression. He is not smiling or laughing. Do NOT copy Qiyu's purple hair, facial expression, clothes or identity. Do NOT make the face more baby-like: keep the refined narrow blue irises, gently lowered upper eyelids, subtle nose and small chin. The change is compact Q anatomy and head size, not rounder infant features.

INVARIANTS: Preserve ALL EIGHT pose roles and their order: top row standing hands in pockets; cross-legged reading; cross-legged headphones/tablet; cross-legged laptop. Bottom row chair reading; chair headphones/tablet; chair laptop; reclining on side with head resting in hand. Preserve Shen Xinghui's cream cardigan with pale-blue edging, white shirt, silver pendant, gray trousers, white/pale-blue shoes, and all books/devices/headphones/chairs. Same face and hairstyle and exact outfit in all poses. All blue eyes visible, all complete feet, hands, hair and props fully inside the image.
Maintain four columns and two rows in a 1536x1024 transparent PNG, one sprite per cell with empty gutters and no overlap. Leave each entire sprite comfortably inside its own cell; prioritize complete silhouettes and generous spacing. No cropping.

BACKGROUND: preserve TRUE TRANSPARENT ALPHA, alpha=0 outside the eight sprites and three chairs. No background, no gradient, no haze, no glow, no ground, no shadow, no base plate, no added décor, no text, no grid lines, no painted checkerboard. Clean isolated cutout edges. This is a targeted proportion/style correction of Image 2, not a new costume or character.
```
