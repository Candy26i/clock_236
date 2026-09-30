(function () {
  'use strict';
  // CSS displays original transparent atlases. No canvas resampling or 3D renderer.
  const atlases = {
    u1: { file: 'assets/characters/2d-v66/qiyu-study-sheet.png', width: 1536, height: 1024,
      frames: [[70,2,212,563],[382,138,354,394],[762,124,360,409],[1144,115,367,420],[62,542,340,466],[449,532,261,473],[773,532,386,474],[1158,648,378,347]] },
    u2: { file: 'assets/characters/2d-v66/xinghui-study-sheet.png', width: 1536, height: 1024,
      frames: [[99,3,199,552],[403,160,340,391],[790,178,337,374],[1153,168,329,385],[58,554,346,457],[450,554,268,455],[785,552,347,458],[1131,714,398,294]] }
  };
  const poseIndex = { stand: 0, think: 0, read: 0, sit: 1, listen: 2, laptop: 3, 'chair-read': 4, 'chair-listen': 5, 'chair-laptop': 6, lie: 7 };
  function refresh(scene = document.getElementById('petScene')) {
    if (!scene) return;
    scene.dataset.renderStyle = '2d';
    scene.querySelectorAll('[data-scene3d]').forEach(wrap => {
      const atlas = atlases[wrap.dataset.scene3d];
      if (!atlas) return;
      const index = poseIndex[wrap.dataset.posture] ?? 0;
      const [x, y, width, height] = atlas.frames[index];
      let sprite = wrap.querySelector('.pet-2d-sprite');
      if (!sprite) {
        sprite = document.createElement('span');
        sprite.className = 'pet-2d-sprite';
        sprite.setAttribute('role', 'img');
        wrap.prepend(sprite);
      }
      const label = (wrap.dataset.role || '') + ' · ' + (wrap.title || '静静陪伴');
      if (sprite.getAttribute('aria-label') !== label) sprite.setAttribute('aria-label', label);
      const signature = wrap.dataset.scene3d + ':' + index;
      if (sprite.dataset.frame !== signature) {
        sprite.dataset.frame = signature;
        sprite.style.backgroundImage = 'url("' + atlas.file + '")';
        sprite.style.backgroundSize = `${atlas.width / width * 100}% ${atlas.height / height * 100}%`;
        sprite.style.backgroundPosition = `${x / (atlas.width - width) * 100}% ${y / (atlas.height - height) * 100}%`;
        wrap.style.setProperty('--sprite-aspect', width / height);
        // The two leftmost drawings narrowly share a bounding rectangle, but
        // their silhouettes do not touch. Clip only the empty corner + neighbor.
        sprite.style.clipPath = wrap.dataset.scene3d === 'u1' && index === 0 ? 'polygon(0 0,100% 0,100% 95%,62% 95%,62% 100%,0 100%)' :
          wrap.dataset.scene3d === 'u1' && index === 4 ? 'polygon(42% 0,100% 0,100% 100%,0 100%,0 5%,42% 5%)' : 'none';
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
