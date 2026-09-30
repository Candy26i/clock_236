# 沈星回 2D 八姿态角色图

- 使用内置 `image_gen`，未使用 CLI 或 Python 图像编辑。
- 成品：`xinghui-study-sheet.png`，1536 × 1024，RGBA。
- 原始生成文件：`/Users/madili/.codex/generated_images/01a0baee-767d-7c60-911b-f22a967a7c77/exec-d1298876-3196-4328-b5f1-94ae0e7a7e72.png`。
- 最终内置编辑输出：`/Users/madili/.codex/generated_images/01a0baee-767d-7c60-911b-f22a967a7c77/exec-a3793ad0-0743-4006-813d-daee554e9013.png`。
- 仅将最终工具原图复制到项目；未裁切、缩放或修改像素。
- 第一次工具调用网络失败，原提示词重试成功；随后一次背景/布局编辑。没有执行后续缩小排版提示词。
- 这是非官方 AI 辅助角色插画，角色身份参考《恋与深空》的沈星回；不是官方角色资源或原画。

## 检查记录

八个姿态按视觉顺序排列：站立、地面盘腿读书、地面盘腿耳机平板、地面盘腿电脑、椅子读书、椅子耳机平板、椅子电脑、低身侧卧。
生成器没有严格遵守 384 × 512 等分格；经集成负责人确认，使用每姿态独立边界裁切，不再重绘。以下为 alpha > 20 的主体连通域半开边界（left, top, right, bottom），包含椅子和设备；八个主体互不接触：

| 姿态 | 像素边界 | 主体像素数 |
| --- | --- | ---: |
| 站立 | [102, 6, 294, 551) | 58,248 |
| 地面读书 | [406, 164, 739, 547) | 77,332 |
| 地面耳机平板 | [793, 182, 1123, 548) | 75,288 |
| 地面电脑 | [1156, 172, 1478, 549) | 74,597 |
| 椅子读书 | [62, 556, 400, 1007) | 81,662 |
| 椅子耳机平板 | [453, 557, 714, 1005) | 77,553 |
| 椅子电脑 | [788, 555, 1128, 1007) | 83,592 |
| 侧卧 | [1134, 717, 1526, 1005) | 66,495 |

透明 alpha=0 像素占 57.9962%；alpha 最大值 254。抽检背景点 (0,0)、(20,20)、(768,20)、(384,512)、(384,300)、(10,900) 的 alpha 均为 0。原图保留透明像素内部的 RGB 背景色，不能仅看忽略 alpha 的工具预览误判背景。alpha 1–20 存在淡边缘/零星噪点，因此 alpha>0 连通域会在个别相邻姿态间连接；不能用 alpha>0 自动分割来替代上述主体边界。alpha>20 除八大主体外只有 17 个零星像素。CSS 裁切应留约 3–5 像素抗锯齿余量并避免纳入相邻姿态。边界数据由 Python/Pillow/Numpy 只读分析，未改像素。

## 生成提示词（完整）

```text
Use case: stylized-concept.
Asset type: one production PNG sprite atlas for a romantic study companion browser game, genuine transparent alpha.
Create ONE image at exactly 1536 x 1024 pixels, landscape 3:2, with exactly EIGHT full-body sprites in an invisible, strict FOUR-column by TWO-row grid. Each cell is 384 x 512 pixels. No drawn grid, no dividers, no text.

Reference image roles:
1. qiyu-study-sheet-draft.png: STYLE REFERENCE ONLY. Match its delicate hand-drawn 2D linework, softly painted watercolor/cel-shaded fabric, attractive mature slender adult male proportions and careful folds. Do NOT copy its purple hair, white button shirt, dark trousers, hazy background, glow, or inconsistent grid spacing.
2. shenxinghui-v65-default.png: OUTFIT AND COLOR REFERENCE ONLY. Copy the cream knit cardigan with pale blue edging, plain white shirt underneath, simple silver pendant, light gray trousers and white sneakers with subtle pale blue details. Do NOT copy the chibi or oversized-head proportions or plastic 3D rendering.
3. xinghui-portrait.jpg: CHARACTER IDENTITY REFERENCE. Depict Shen Xinghui / Xavier from Love and Deepspace: soft silver-white layered hair, clear muted blue eyes, refined mature facial structure, calm attentive expression, quiet reliability and a slight sleepy gentleness. Keep the same identity across all eight poses. Transform into the 2D hand-painted style of reference 1.

Character: clearly an adult young man, slender mature approximately 7.5-head-tall anatomy in standing pose, ordinary adult-sized head, long adult limbs, subtle facial modeling, natural hands. Consistent outfit and proportions in every cell. Tender understated expression, not goofy, not exaggerated grinning.

Exact pose order, left to right:
TOP ROW:
Cell 1 (x 0-383, y 0-511): full-body relaxed standing, hands in cardigan or trouser pockets, both shoes visible.
Cell 2 (x 384-767): sitting cross-legged directly on an invisible floor, reading an open book held naturally in his lap. No cushion, mat, chair or floor.
Cell 3 (x 768-1151): cross-legged directly on invisible floor, wearing subtle white over-ear headphones, holding and studying a tablet.
Cell 4 (x 1152-1535): cross-legged directly on invisible floor, working on a complete compact open laptop on his lap.
BOTTOM ROW:
Cell 5 (x 0-383, y 512-1023): seated on a simple warm-gray wooden chair, reading an open book, both feet placed down separately; entire chair legs and both shoes visible.
Cell 6 (x 384-767): same simple warm-gray wooden chair, white headphones and tablet, both feet down and complete chair visible.
Cell 7 (x 768-1151): same chair, complete compact laptop on lap, both feet down and complete chair visible.
Cell 8 (x 1152-1535): resting low on his side directly on invisible floor, one bent elbow supports his head, the other hand relaxed, legs gently bent to fit inside his cell. Entire body and both shoes visible, calm slightly sleepy gaze toward viewer.

Layout constraints: all eight figures including hair, hands, devices, chairs and feet MUST fit fully within their own cell. At least 18px clear transparent padding on every edge of every cell. Center each sprite horizontally in its own cell. Bottom-align support points near y=492 in the top row and y=1004 in the bottom row. Do not let a tall standing sprite extend into the lower row. Do not stretch a lying sprite into the neighboring cell. Pose may be scaled to fit each cell; no body or prop may be cropped. Exactly one character per cell, exactly eight total. Each sprite is separately isolated.

Background is literal EMPTY TRANSPARENCY, an actual PNG alpha channel: alpha=0 everywhere outside characters, their clothes, handheld props and the three chairs. This includes between legs, chair openings and every gap. Absolutely no colored or black/white backdrop, no fog, no haze, no halo, no ambient glow, no ground plane, no floor, no ground shadows, no drawn transparency checkerboard, no outline stickers. The reference 1 background must not transfer. Keep clothing and skin opaque. Clean anti-aliased edges only.
No text, labels, watermarks, decorative particles, framing, extra furniture, desks, cushions, or environment. No chibi, large head, baby face, plush toy or plastic 3D material.
```

## 一次编辑提示词（完整）

```text
Use case: background-extraction with sprite sheet layout correction.
Edit ONLY the attached Shen Xinghui eight-pose sprite sheet. Preserve all eight poses, face identities, mature adult body proportions, silver hair, blue eyes, cream/pale blue cardigan, white shirt, pendant, gray trousers, white shoes, book/tablet/laptop, white headphones and three simple chairs. Preserve the delicate hand-painted 2D style. Do not add, remove or swap poses.
CRITICAL CHANGE 1: Erase every single background pixel completely to an ACTUAL TRANSPARENT PNG ALPHA CHANNEL. The dark gray background and every blurry gray-white glow around each sprite MUST be removed. Empty areas must be alpha=0. No black background, no white background, no colored fill, no haze, no glow, no ground shadow, no checkerboard painted into the image. Only the eight cleanly cut-out people and their props/chairs remain. Remove background in holes between chair legs and all openings. Anti-aliased crisp illustrated silhouette edges only, not feathered halos.
CRITICAL CHANGE 2: Correct the sheet layout to EXACTLY 1536 x 1024 pixels with four columns and two rows, each cell 384 x 512. Existing upper row extends too low: uniformly scale down/reposition each upper-row sprite so every pixel including shoes fits at y=20..492. Lower-row sprite pixels must fit at y=532..1004. All eight sprites need at least 20px empty transparent margin inside their own 384px-wide cells: column 1 x=20..364, column 2 x=404..748, column 3 x=788..1132, column 4 x=1172..1516. The bottom-left chair sprite currently overlaps the next cell; fit its full body and chair into column1. The reclining bottom-right character currently extends left of its cell; fit its full body into column4. Center each sprite in its own cell and keep its aspect ratio. Keep full heads, shoes, hands, props and chair legs visible. Exactly eight independently separated sprites, no touching across cells. No visible grid, no text or added objects.
The deliverable must be genuine RGBA with a fully transparent background, not a scene and not an opaque imitation of transparency.
```

