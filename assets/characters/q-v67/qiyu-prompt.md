# 祁煜 Q 版精修 v67

## 最终排布精修提示词

Use case: precise-object-edit. This is an eight-pose transparent sprite atlas of Rafayel. Preserve every character drawing's exact face, dark blue-violet hair color, Q chibi proportions, clothes, pose and props. ONLY correct the spacing: scale EACH of the eight complete drawings down by about 18 percent, and center each in its own cell in a strict FOUR-column TWO-row grid. Each cell must have clear empty transparent margins on ALL four sides; particularly the top-left standing figure's shoes MUST NOT touch the bottom-left seated figure's hair. Bottom-right reclining figure MUST NOT enter the neighboring chair-laptop cell. It is okay that figures appear smaller on the overall sheet. Output eight unchanged beautiful drawings, fully visible including shoes and chairs, with lots of transparent empty space between them. TRUE RGBA transparent background, no background color, haze, glow, ground, checkerboard, text or watermark. Do not add/remove poses, do not change character identity or style.

以上排布精修得到最终 `qiyu-study-sheet.png`，保证每个姿态留白、人物不互相接触。

## 最终局部精修提示词

Use case: precise-object-edit. Image 1 is the selected eight-pose chibi sprite sheet of Rafayel / 祁煜. Image 2 is the official hair-color reference. Change ONLY the character's hair tone in every pose from pale dusty lavender to the rich dark blue-violet / muted indigo aubergine of image 2, with soft violet highlights. Keep it clearly purple, not brown or flat black. Preserve ALL eight poses, the exact cute Q head-to-body proportions, faces, violet eyes, sly tender small smiles, hands, books, headphones, laptops, chairs, clothing, composition and transparent alpha unchanged. Keep the refined illustrated softly volumetric Q style of image 1; do not turn him into a realistic adult. Exact same 4 by 2 sprite composition. Actual RGBA transparent background; no colored backdrop, haze, glow, ground, lettering or watermark.

以下为初次生成提示词；最终 PNG 使用上述深蓝紫发色精修结果。

使用内置 `image_gen`，2026-09-29。参考原 Q 版站姿、地坐姿态和项目中原样保存的官方竖版人物图。保留生成 PNG 的 alpha，未作像素后处理。

完整提示词：

Use case: style-transfer.
Asset type: production transparent 2D sprite atlas for a cozy study companion game.
Input images: image 1 and image 2 are the user's PREFERRED PREVIOUS Q/chibi art, the standing and sitting Rafayel / 祁煜. Preserve their charming soft rendered illustrated texture, clothing and approachable cuteness. Image 3 is the official character identity reference for his dark violet layered wavy hair, expressive violet-pink eyes and artistic personality; use identity cues, not its realistic adult proportions.

Primary request: refine the beloved Q version of 祁煜 into one extremely consistent eight-pose chibi illustration sheet. All eight depict the SAME handsome charming adult male character stylized as a 3.3-head-tall collectible Q character, graceful torso and small slim limbs, large expressive head but NOT a toddler, NOT a realistic seven-head-tall man. Match the reference soft luminous painted volume rather than thick cartoon outlines. Hair should be deep dusky violet with soft waves, less giant inflated hair than image 1, natural side fringe and separated locks. Refine facial identity: subtly upturned almond violet-pink eyes with delicate upper lashes, expressive eyebrows, fine little nose, soft chin, restrained playful closed-mouth smile; smart teasing warmth, not a bland generic anime boy and not a broad grin. The eyes must be visible and expressive even in reading poses. Fine hair and fabric shading, pearl-white loose open collar shirt with gently rolled sleeves, charcoal trousers, belt, white sneakers, artist's spiral sketchbook and pencil. Same exact face, hair, head-to-body proportion and outfit in EVERY pose.

Composition: exactly FOUR columns and TWO rows on a landscape 3072x2048 transparent RGBA canvas, each pose FULLY contained within its own equally sized cell. At least 64px entirely transparent margin on every cell side. No silhouette or chair can touch a cell edge or overlap another cell. NO labels or lettering. Transparent outside figures and held props, no floor or backdrop.
Top row left to right:
1. full-body standing, one hand pocket, other hand holding closed small sketchbook, looking affectionately forward.
2. sitting cross-legged DIRECTLY on floor with NO cushion or mat, sketchbook on knees, pencil in hand, eyes glance toward viewer.
3. sitting cross-legged wearing unobtrusive over-ear headphones, hands hold small tablet and stylus, attentive gaze.
4. sitting cross-legged with a slim open laptop on lap, thoughtful small smile.
Bottom row left to right:
5. sitting on simple slim warm gray upholstered wooden chair, spiral sketchbook on lap and pencil in hand, BOTH shoes and all chair legs completely visible.
6. same chair, headphones and tablet, relaxed alert violet eyes.
7. same chair, slim laptop on lap, typing.
8. lying on one side, propped on elbow with head resting on hand, legs tucked naturally, softly playful face, whole body and feet visible.
Lighting: soft neutral warm studio illumination, delicate interior highlights. Hand-painted Q illustration with polished sculptural softness. Absolutely clean transparent alpha outside characters, NO checkerboard drawn into image, no glow, no haze, no background color, no contact shadow, no floating sparkles, no rugs, no text, no chibi baby proportions. Keep generous negative space separating each sprite.
