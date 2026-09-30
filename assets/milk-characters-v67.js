(function () {
  'use strict';
  // Refined Q illustrations, rendered as transparent 2D sprites with shared scene anchors.
  const atlases = {
    u1: { file: 'assets/characters/q-v67/qiyu-study-sheet.png', width: 1536, height: 1024,
      frames: [[72,62,246,441],[423,121,280,373],[805,103,270,391],[1183,106,272,401],[71,550,295,419],[426,551,286,417],[797,553,296,418],[1105,667,396,289]] },
    u2: { file: 'assets/characters/q-v67/xinghui-study-sheet.png', width: 1536, height: 1024,
      frames: [[83,42,243,478],[445,111,279,408],[822,119,271,402],[1208,115,273,405],[91,532,284,457],[466,538,278,451],[816,539,288,448],[1122,712,399,257]] }
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
        sprite.style.clipPath = 'none';
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
