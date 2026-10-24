# Greenhouse white round table — v72

Generated with the built-in image generation tool, editing the original greenhouse background embedded in index.html. The source architecture, flowers and daylight are preserved; the foreground desk and stationery are replaced.

Asset: `greenhouse-white-round-table-v72.png` (1672 × 941).

## Generation prompt

Use case: precise-object-edit. Edit target: the supplied empty greenhouse background for an existing illustrated companion scene. Preserve the beautiful greenhouse architecture, flowers, daylight, windows and distant mountain/lake view, and the warm detailed painterly rendering. Replace ONLY the large wooden foreground rectangular desk AND all its laptop, books, pen holder and stationery with a refined small ROUND ivory-white French garden tea table, seen close from the viewer's seated side. The camera is at the near side of the table looking across at two future companions (do NOT draw people). Table has a subtle white carved/ridged rim, smooth mostly plain warm-white tabletop with very faint stone/paint texture, elegant not ornate. Circular tabletop appears as a wide horizontal ellipse in perspective, centered x=50%, backmost rim around y=73% of the image, extending roughly x=8% to x=92%, and its near half is cropped by the bottom edge, so the viewer sees about two thirds of the tabletop and a sliver of apron, never the entire table and legs. Leave clear empty floor behind its far edge for later character compositing. The tabletop is entirely clear for interactive snacks and a milk-tea cup to be added later. Important: no computers, books, stationery, cups, plates, flowers or objects on this foreground table; no people, text or UI. Keep landscape 16:9 composition and the original greenhouse's visual identity. Camera composition should convincingly feel like sitting across a white bistro table in this flower conservatory, rather than looking down at a distant tiny table.

## Compositing

The resulting table differs slightly from the requested coordinates, so all contact geometry follows the actual output: outer ellipse center (0.5, 0.846), radii (0.442, 0.202); usable tabletop center (0.5, 0.84), radii (0.412, 0.182). These source-space outlines follow the same cover crop as the background on every viewport. The foreground copy masks lower bodies along the curved rim.

Figure scale is calibrated from measured hair width relative to the individual pose's frame height. Both figures share a target head width; seated heads sit lower than standing heads. This avoids equating whole sprite heights when artwork has different proportions. This calibration is used only in the greenhouse.

Validation: desktop, tablet and mobile scene/pose/interaction matrix, anatomical scale regression, plus the u2-host seated/u1-guest standing arrangement in the user's screenshot. All fixtures block external HTTP/WebSockets and use the demo database.
