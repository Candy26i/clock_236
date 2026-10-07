(function () {
  'use strict';
  // Use the user-selected v65 proportions and rendering while retaining the corrected scene anchors.
  const atlases = {"u1":{"poses":[{"file":"assets/characters/reference-v68/qiyu-master.png","width":1122,"height":1402,"frame":[365,17,431,1374]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[405,120,283,416]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[796,118,305,428]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[1187,118,310,431]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[52,552,290,462],"clip":"polygon(34% 0,100% 0,100% 100%,0 100%,0 1.2%,34% 1.2%)"},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[421,546,233,457]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[752,567,283,445]},{"file":"assets/characters/reference-v68/qiyu-study-sheet.png","width":1536,"height":1024,"frame":[1039,733,488,278]}]},"u2":{"poses":[{"file":"assets/characters/shenxinghui-v65-default.png","width":1122,"height":1402,"frame":[366,26,422,1366]},{"file":"assets/characters/shenxinghui-v65-sit.png","width":1254,"height":1254,"frame":[291,11,877,1213]},{"file":"assets/characters/shenxinghui-v65-listen.png","width":1254,"height":1254,"frame":[234,22,896,1205]},{"file":"assets/characters/shenxinghui-v65-laptop.png","width":1254,"height":1254,"frame":[273,26,899,1222]},{"file":"assets/characters/shenxinghui-v65-chair-read.png","width":1122,"height":1402,"frame":[258,16,692,1365]},{"file":"assets/characters/shenxinghui-v65-chair-listen.png","width":1122,"height":1402,"frame":[275,19,612,1369]},{"file":"assets/characters/shenxinghui-v65-chair-laptop.png","width":1122,"height":1402,"frame":[264,20,644,1367]},{"file":"assets/characters/shenxinghui-v65-lie.png","width":1672,"height":941,"frame":[23,110,1640,801]}]}};
  const shenExtra = {"think": {"file": "assets/characters/shenxinghui-v65-think.png", "width": 1121, "height": 1403, "frame": [49, 17, 826, 1362]}, "hug": {"file": "assets/characters/shenxinghui-v65-hug.png", "width": 1122, "height": 1402, "frame": [33, 16, 1023, 1371]}, "pat": {"file": "assets/characters/shenxinghui-v65-pat.png", "width": 1122, "height": 1402, "frame": [49, 17, 987, 1371]}};
  const poseIndex = { stand: 0, think: 0, read: 0, sit: 1, listen: 2, laptop: 3, 'chair-think': 6, 'chair-read': 4, 'chair-listen': 5, 'chair-laptop': 6, lie: 7 };
  function refresh(scene = document.getElementById('petScene')) {
    if (!scene) return;
    scene.dataset.renderStyle = '2d';
    scene.querySelectorAll('[data-scene3d]').forEach(wrap => {
      const atlas = atlases[wrap.dataset.scene3d];
      if (!atlas) return;
      const index = poseIndex[wrap.dataset.posture] ?? 0;
      const special=wrap.dataset.interaction || wrap.dataset.posture;
      const source = wrap.dataset.scene3d==='u2' && shenExtra[special] ? shenExtra[special] : atlas.poses[index];
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
        sprite.style.backgroundSize = `${source.width / width * 100}% ${source.height / height * 100}%`;
        sprite.style.backgroundPosition = `${x / (source.width - width) * 100}% ${y / (source.height - height) * 100}%`;
        wrap.style.setProperty('--sprite-aspect', width / height);
        sprite.style.clipPath = source.clip || 'none';
      }
      // Legacy img remains an event/data hook; only the 2D illustration is visible.
      const legacy = wrap.querySelector('.pet-3d-character');
      if (legacy) { legacy.setAttribute('aria-hidden', 'true'); legacy.alt = ''; }
    });
    window.MilkSceneLayout?.refresh(scene);
  }
  window.MilkCharacters = { refresh, atlases };
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
