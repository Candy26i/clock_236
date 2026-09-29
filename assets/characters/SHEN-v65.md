# 小莲统一形象 v65

生成方式：内置 image_gen（透明背景），2026-09-29。用户已确认基础形象比例，并要求按此统一动作。图片保存在本目录 `shenxinghui-v65-*.png`，共14张；点心保存在 `../snacks/`。

保留青年高瘦体型、原动作及服装；收拢发量、增加露出的脸部面积、柔化下巴。表情包含专注、温柔、思考、困倦与互动微笑。

## 基础图完整提示词

Use case: identity-preserve. Create a corrected full-body 3D stylized male companion using two references. Image 1 is the user's PREFERRED FACE: retain its soft rounded lower face, broad rounded short chin with NO point, pale-blue glass eyes, tiny relaxed lips and very soft volumetric CGI sculpting. Image 2 provides the approved lean young ADULT body, long legs, shoulders, clothing and standing hands-in-pockets pose. CRITICAL CORRECTION: hair currently overwhelms the small face. Reduce the top/back hair volume by 30 percent, bring top hair closer to the skull, shorten the thick fringe enough to expose more forehead/eyebrows, keep silver layered hairstyle but no giant puffball. Enlarge the visible facial area relative to hair; a well-balanced broad soft oval face, not a tiny triangle hidden beneath hair. Face occupies roughly lower half of head silhouette; top hair cap is compact. Head-to-body is tasteful young-adult Q collectible about 3.7 heads tall, NOT toddler, NOT normal realistic human. Keep image 2's taller torso and long slim lightly athletic body unchanged. Expression quietly cool, gentle and composed, mouth closed, subtly relaxed eyelids; not pouty, not grinning, not sparkly baby-cute. Preserve original image 1's sculpted face style, no 2D anime ink lines, no angular chin or long pointed jaw. Same cream cardigan pale-blue trim, white knit, pendant, gray trousers and white sneakers. Whole body centered portrait, feet visible, small margins. True clean alpha transparent background, no ground, backdrop, glow, aura, fog, vignette or text.

参考：用户偏好的原脸（`../references/shen-preferred-face.png`）和上一版成年体型。

## 动作共用完整提示词

Use case: identity-preserve. Image 1 is the USER APPROVED new master character: copy its EXACT balanced head proportions, compact silver hair cap with exposed brow/forehead, larger visible face, softly broad rounded chin and original soft 3D CGI face. Image 2 is the existing pose to update: KEEP its full body, long lean youthful adult build, outfit, hand placement, props and pose essentially unchanged. Replace its old oversized hair / small triangular face with master image 1's head design. Hair must not inflate or conceal face. NO pointed chin, no sharp V jaw, no anime ink outline; maintain original soft volumetric collectible render. Head expression adapts subtly as described, but mature calm tender temperament, not a baby, not exaggerated grin. Consistent approved tall slim Q figure. Whole body, feet and props visible. Match aspect/framing of pose reference, small margins. TRUE clean transparent alpha outside character and props, absolutely no glow/halo/fog/background/ground. 

参考顺序：v65-default（已确认的脸与比例），同名v64动作（保留身体、道具和姿势）。每张在共用提示词后追加：

- **chair-read**：Quietly reads navy book, eyes slightly lowered, closed neutral lips.
- **chair-listen**：Both hands hold tablet, wears headphones; calm attentive eyes, neutral gentle lips. Never touch earcup.
- **chair-laptop**：Typing on lap laptop, thoughtful lowered gaze, soft brows, closed mouth.
- **sit**：Cross-legged holding open book on lap, quiet attentive face.
- **listen**：Cross-legged headphones, tablet and stylus; quiet concentration, keep hands on tablet/stylus.
- **laptop**：Cross-legged three-quarter laptop typing, softly focused gaze.
- **lie**：Reclining with head on hand, closed navy book against chest; half-lidded sleepy eyes, neutral tender mouth. No halo around silhouette.
- **read**：Standing reading book in both hands, focused serene eyes.
- **think**：Standing one hand in pocket, index finger at chin, tiny parted lips and mild curious eyes: occasional absent-minded charm.
- **gentle**：Standing touching pendant, other hand in pocket, restrained small closed-mouth smile, warm eyes.
- **focus**：Standing holding CLOSED notebook against chest, other hand pocket, quiet cool gaze.
- **hug**：Arms gently forward inviting hug, small closed-mouth tender smile, no wide grin or heavy blush.
- **pat**：Hands lightly hold cardigan edges at chest, eyes gently closed and tiny contented smile. No additional hand/person. Head only slightly bowed forward.

旧版已按用户要求从项目删除；历史提示词文档保留作制作记录。

