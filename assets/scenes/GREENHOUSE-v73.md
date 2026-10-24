# Greenhouse study table — v73

Edited `greenhouse-white-round-table-v72.png` with the built-in image generation tool. The selected output is stored in this project as `greenhouse-study-table-v73.png`; it does not depend on a temporary or generated-images folder at runtime.

## Final prompt

Edit the supplied greenhouse background. Preserve EXACT camera, 1672x941 landscape composition, entire conservatory, lighting, and especially the exact white oval tabletop silhouette and rim. Add carefully arranged study objects on the foreground white table: an elegant small open silver laptop with its screen and keyboard FACING THE VIEWER (viewer is studying here), located lower left, footprint x=25-46%, y=83-97%, top of screen no higher than y=77%; beside it an open cream notebook with a fine pen, pages oriented to viewer, lower middle x=48-64%, y=88-98%. At far left edge of table x=17% y=79%, a tiny low porcelain vase with just three delicate flowers and a tiny ceramic bird; at far right edge x=88% y=80%, a small low succulent pot. These decorations are SMALL and understated, do not obscure the space above table. Leave the rear middle tabletop y=66-81% completely EMPTY for composited characters and plates. Leave lower right tabletop x=72-84% y=85-95% EMPTY for a large interactive milk tea cup. All objects must rest naturally with subtle shadows, match existing detailed painterly illustrated style, refined flower conservatory study ambiance. No humans, no additional cups or plates, no UI/text. Do not enlarge table or change outline or greenhouse. Laptop must be open with visible screen facing camera, not back of lid.

## Placement

The round table retains the v72 ellipse. Its foreground mask additionally traces the laptop screen, so seated companions remain behind the computer. The notebook and laptop face the viewer. Small flowers, a porcelain bird and a succulent sit at the sides.

Tea is 86 × 120 CSS pixels on desktop and 66 × 92 on mobile. Desktop servings use the clear strip behind the notebook and the lower-right space beside it. Mobile servings move to the clear upper tabletop because the cover crop brings the notebook into the lower-right foreground. Layout uses the corresponding cup footprint when clamping to the table.

Browser visual checks for this version were not run because permission to launch the local test browser was declined. The browser regression tests have been updated but still need to be run.
