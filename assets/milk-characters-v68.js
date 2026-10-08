(function () {
  'use strict';
  // Use the user-selected v65 proportions and rendering while retaining the corrected scene anchors.
  const atlases = {"u1":{"poses":[{"file":"assets/characters/reference-v68/qiyu-master.png","width":1122,"height":1402,"frame":[365,17,431,1374]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[405,120,283,416]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[796,118,305,428]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[1187,118,310,431]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[52,552,290,462],"clip":"polygon(34% 0,100% 0,100% 100%,0 100%,0 1.2%,34% 1.2%)"},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[421,546,233,457]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[752,567,283,445]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[1039,733,488,278]}]},"u2":{"poses":[{"file":"assets/characters/shenxinghui-v65-default.png","width":1122,"height":1402,"frame":[366,26,422,1366]},{"file":"assets/characters/shenxinghui-v65-sit.png","width":1254,"height":1254,"frame":[291,11,877,1213]},{"file":"assets/characters/shenxinghui-v65-listen.png","width":1254,"height":1254,"frame":[234,22,896,1205]},{"file":"assets/characters/shenxinghui-v65-laptop.png","width":1254,"height":1254,"frame":[273,26,899,1222]},{"file":"assets/characters/shenxinghui-v65-chair-read.png","width":1122,"height":1402,"frame":[258,16,692,1365]},{"file":"assets/characters/shenxinghui-v65-chair-listen.png","width":1122,"height":1402,"frame":[275,19,612,1369]},{"file":"assets/characters/shenxinghui-v65-chair-laptop.png","width":1122,"height":1402,"frame":[264,20,644,1367]},{"file":"assets/characters/shenxinghui-v65-lie.png","width":1672,"height":941,"frame":[23,110,1640,801]}]}};
  const shenExtra = {"think": {"file": "assets/characters/shenxinghui-v65-think.png", "width": 1121, "height": 1403, "frame": [371, 21, 407, 1353]}, "hug": {"file": "assets/characters/shenxinghui-v65-hug.png", "width": 1122, "height": 1402, "frame": [352, 21, 560, 1363]}, "pat": {"file": "assets/characters/shenxinghui-v65-pat.png", "width": 1122, "height": 1402, "frame": [370, 23, 416, 1362]}};
  const proneFigures={"u1": {"file": "assets/characters/touch-v69/u1-prone.png", "width": 1774, "height": 887, "frame": [9, 7, 1751, 868]}, "u2": {"file": "assets/characters/touch-v69/u2-prone.png", "width": 1774, "height": 887, "frame": [19, 19, 1744, 840]}};
  Object.entries(proneFigures).forEach(([uid,source])=>atlases[uid].poses.push(source));
  const poseIndex = { stand: 0, think: 0, read: 0, sit: 1, listen: 2, laptop: 3, 'chair-think': 6, 'chair-read': 4, 'chair-listen': 5, 'chair-laptop': 6, lie: 7, prone: 8 };
  const touchStates=new Map();
  const readyReactions=new Set(),loadingReactions=new Set();
  function preloadReaction(source){if(!source||readyReactions.has(source.file)||loadingReactions.has(source.file))return;loadingReactions.add(source.file);const image=new Image();image.onload=()=>{readyReactions.add(source.file);refresh();};image.onerror=()=>loadingReactions.delete(source.file);image.src=source.file;}
  const touchFiles={"u1": [{"file": "assets/characters/touch-v69/u1-default.png", "width": 1122, "height": 1402, "frame": [364, 18, 430, 1372]}, {"file": "assets/characters/touch-v69/u1-sit.png", "width": 1371, "height": 1148, "frame": [337, 26, 749, 1107]}, {"file": "assets/characters/touch-v69/u1-listen.png", "width": 1368, "height": 1149, "frame": [320, 12, 877, 1136]}, {"file": "assets/characters/touch-v69/u1-laptop.png", "width": 1374, "height": 1145, "frame": [350, 14, 847, 1130]}, {"file": "assets/characters/touch-v69/u1-chair-read.png", "width": 1024, "height": 1536, "frame": [128, 9, 896, 1514]}, {"file": "assets/characters/touch-v69/u1-chair-listen.png", "width": 1024, "height": 1536, "frame": [166, 8, 758, 1489]}, {"file": "assets/characters/touch-v69/u1-chair-laptop.png", "width": 1145, "height": 1374, "frame": [246, 55, 742, 1258]}, {"file": "assets/characters/touch-v69/u1-lie.png", "width": 1536, "height": 1024, "frame": [39, 105, 1485, 844]}, {"file": "assets/characters/touch-v69/u1-prone-smile.png", "width": 1774, "height": 887, "frame": [10, 4, 1752, 871]}], "u2": [{"file": "assets/characters/touch-v69/u2-default.png", "width": 1122, "height": 1402, "frame": [369, 29, 416, 1359]}, {"file": "assets/characters/touch-v69/u2-sit.png", "width": 1254, "height": 1254, "frame": [295, 15, 870, 1206]}, {"file": "assets/characters/touch-v69/u2-listen.png", "width": 1254, "height": 1254, "frame": [237, 26, 890, 1198]}, {"file": "assets/characters/touch-v69/u2-laptop.png", "width": 1254, "height": 1254, "frame": [277, 30, 893, 1214]}, {"file": "assets/characters/touch-v69/u2-chair-read.png", "width": 1122, "height": 1402, "frame": [259, 19, 688, 1361]}, {"file": "assets/characters/touch-v69/u2-chair-listen.png", "width": 1122, "height": 1402, "frame": [279, 19, 607, 1365]}, {"file": "assets/characters/touch-v69/u2-chair-laptop.png", "width": 1122, "height": 1402, "frame": [266, 23, 639, 1362]}, {"file": "assets/characters/touch-v69/u2-lie.png", "width": 1672, "height": 941, "frame": [26, 113, 1633, 795]}, {"file": "assets/characters/touch-v69/u2-prone-smile.png", "width": 1774, "height": 887, "frame": [20, 19, 1743, 842]}]};
  const thinkReaction={"file": "assets/characters/touch-v69/u2-think-smile.png", "width": 1121, "height": 1403, "frame": [368, 20, 410, 1356]};
  function react(uid){
    const wrap=document.querySelector('#petScene [data-scene3d="'+uid+'"]');
    if(!wrap||wrap.dataset.interaction)return;
    const previous=touchStates.get(uid),now=Date.now();
    if(previous&&now-previous.started<600)return;
    const state={posture:wrap.dataset.posture,scene:wrap.closest('#petScene').dataset.sceneMode,started:now,until:now+4600};
    touchStates.set(uid,state);refresh();
    setTimeout(()=>{if(touchStates.get(uid)===state){touchStates.delete(uid);refresh();}},4650);
  }
  function refresh(scene = document.getElementById('petScene')) {
    if (!scene) return;
    scene.dataset.renderStyle = '2d';
    scene.querySelectorAll('[data-scene3d]').forEach(wrap => {
      const atlas = atlases[wrap.dataset.scene3d];
      if (!atlas) return;
      const floor=['room','outdoor','seaside'].includes(scene.dataset.sceneMode);
      const requested=wrap.dataset.posture;
      const safePosture=floor&&requested.startsWith('chair-')?(requested==='chair-listen'?'listen':requested==='chair-laptop'?'laptop':'sit'):requested;
      const index = poseIndex[safePosture] ?? 0;
      const special=wrap.dataset.interaction || wrap.dataset.posture;
      const normal = wrap.dataset.scene3d==='u2' && shenExtra[special] ? shenExtra[special] : atlas.poses[index];
      const state=touchStates.get(wrap.dataset.scene3d);
      const touched=state&&state.until>Date.now()&&state.posture===requested&&state.scene===scene.dataset.sceneMode&&!wrap.dataset.interaction;
      const reaction=wrap.dataset.scene3d==='u2'&&special==='think'?thinkReaction:touchFiles[wrap.dataset.scene3d]?.[index];
      preloadReaction(reaction);
      const source=touched&&reaction&&readyReactions.has(reaction.file)?reaction:normal;
      wrap.classList.toggle('pet-touch-soft',!!touched);
      const [x, y, width, height] = source.frame;
      let sprite = wrap.querySelector('.pet-2d-sprite');
      if (!sprite) {
        sprite = document.createElement('span');
        sprite.className = 'pet-2d-sprite';
        sprite.setAttribute('role', 'button');sprite.tabIndex=0;sprite.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();sprite.click();}};
        wrap.prepend(sprite);
      }
      const label = (wrap.dataset.role || '') + ' · ' + (wrap.title || '静静陪伴');
      if (sprite.getAttribute('aria-label') !== label) sprite.setAttribute('aria-label', label);
      const signature = wrap.dataset.scene3d + ':' + index + ':' + source.file;
      if (sprite.dataset.frame !== signature) {
        sprite.dataset.frame = signature;
        sprite.style.backgroundImage = 'url("' + source.file + '")';
        // The box keeps the resting pose's aspect. Any frame (resting or touch) is fitted by height and
        // centred, so a touch frame with a slightly different crop never stretches the body.
        const boxAspect = normal.frame[2] / normal.frame[3], fullWidth = source.width / height, fullHeight = source.height / height;
        const offsetX = (boxAspect - width / height) / 2 - x / height, offsetY = -y / height;
        const spanX = boxAspect - fullWidth, spanY = 1 - fullHeight;
        sprite.style.backgroundSize = `${fullWidth / boxAspect * 100}% ${fullHeight * 100}%`;
        sprite.style.backgroundPosition = `${Math.abs(spanX) < 1e-6 ? 50 : offsetX / spanX * 100}% ${Math.abs(spanY) < 1e-6 ? 0 : offsetY / spanY * 100}%`;
        wrap.style.setProperty('--sprite-aspect', boxAspect);
        sprite.style.clipPath = source.clip || 'none';
      }
      // Legacy img remains an event/data hook; only the 2D illustration is visible.
      const legacy = wrap.querySelector('.pet-3d-character');
      if (legacy) { legacy.setAttribute('aria-hidden', 'true'); legacy.alt = ''; }
    });
    window.MilkSceneLayout?.refresh(scene);
  }
  window.MilkCharacters = { refresh, atlases, react };
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; refresh(); });
  };
  const start = () => {
    const host = document.getElementById('petChar');
    if (!host) return;
    new MutationObserver(schedule).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-posture','data-scene3d','data-interaction','title'] });
    refresh();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
