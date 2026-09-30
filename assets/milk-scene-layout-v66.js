/* Presentation only: no account data, timers, storage, or database access. */
(function(global){
  'use strict';
  // Serving coordinates are [main x/y, guest x/y, tea x/y], in canvas percent.
  const scenes={
    room:{feet:.78,ground:.79,chair:.96,x:[35,67],desktop:[35,88,69,88,80,90],mobile:[28,93,82,93,66,95]},
    outdoor:{feet:.82,ground:.85,lie:.89,x:[35,66],desktop:[39,91,65,91,76,92],mobile:[41,94,65,94,80,95]},
    cafe:{feet:.96,chair:1.01,x:[38,65],desktop:[48,88,67,91,79,92],mobile:[51,93,68,93,83,94]},
    library:{feet:.86,chair:.97,x:[36,65],desktop:[35,88,69,88,80,90],mobile:[28,93,82,93,66,95]},
    meeting:{feet:.99,chair:1.025,x:[36,65],scale:1,desktop:[68,90,80,86,90,91],mobile:[12,82,83,84,93,89]},
    studio:{feet:.91,chair:1.0,x:[35,66],desktop:[68,89,81,89,92,93],mobile:[76,87,90,88,83,97]},
    greenhouse:{feet:.77,chair:.92,x:[36,65],desktop:[29,88,74,88,84,91],mobile:[8,89,92,89,69,96]},
    terrace:{feet:.79,chair:.95,x:[36,65],desktop:[34,93,65,93,79,94],mobile:[62,91,85,91,75,97]},
    train:{feet:.91,chair:.99,x:[36,66],desktop:[42,93,63,93,55,91],mobile:[52,84,82,84,66,92]},
    seaside:{feet:.8,ground:.87,lie:.89,x:[33,68],desktop:[40,90,61,90,72,92],mobile:[42,94,65,94,81,95]},
    jiangnan:{feet:.88,chair:.99,x:[35,66],desktop:[72,88,83,89,93,92],mobile:[25,94,85,94,54,96]},
    cloudrealm:{feet:.77,chair:.93,x:[35,66],desktop:[69,92,84,92,77,95],mobile:[70,94,90,95,54,96]}
  };
  // Foreground outlines in the unchanged source image's normalized coordinates.
  // The notch follows the laptop silhouette; CSS maps the source's cover crop at every width.
  const outlines={
    greenhouse:[[0,.790],[1,.790],[1,1],[0,1]],
    terrace:[[0,.868],[1,.868],[1,1],[0,1]],
    jiangnan:[[0,.758],[.426,.758],[.430,.740],[.445,.738],[.452,.758],[1,.758],[1,1],[0,1]],
    cloudrealm:[[0,.800],[.436,.800],[.437,.767],[.472,.757],[.488,.800],[1,.800],[1,1],[0,1]],
    meeting:[[0,.777],[.427,.777],[.426,.718],[.431,.706],[.610,.706],[.617,.713],[.617,.777],[1,.777],[1,1],[0,1]],
    studio:[[0,.830],[.412,.830],[.411,.760],[.417,.750],[.580,.750],[.585,.757],[.584,.830],[1,.830],[1,1],[0,1]],
    train:[[0,.777],[.230,.777],[.225,.714],[.230,.699],[.464,.699],[.472,.705],[.471,.777],[.740,.777],[.748,.745],[.813,.737],[.831,.753],[.835,.777],[1,.777],[1,1],[0,1]]
  };
  // Contact planes were traced from the unmodified background/table art. They intentionally
  // exclude the floor; source-space planes follow the same cover crop as the image.
  const tableTop={meeting:.777,studio:.830,greenhouse:.790,terrace:.868,train:.777,jiangnan:.758,cloudrealm:.800};
  const geometry=new WeakMap();
  const dimensions=new Map();
  let scheduled=0, current=null;
  function number(value,fallback){const n=parseFloat(value);return Number.isFinite(n)&&n>0?n:fallback;}
  function imageSize(src,scene){
    let item=dimensions.get(src);if(item)return item;
    item={width:1672,height:941};dimensions.set(src,item);
    const image=new Image();image.onload=()=>{item.width=image.naturalWidth;item.height=image.naturalHeight;if(scene.isConnected)schedule();};image.src=src;
    return item;
  }
  function cover(scene){
    const ambient=scene.querySelector(':scope > .scene-ambient:not(.scene-depth-foreground)');
    if(!ambient)return null;
    const style=getComputedStyle(ambient),match=style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    if(!match)return null;
    const size=imageSize(match[1],scene),w=scene.clientWidth,h=scene.clientHeight;
    const scale=Math.max(w/size.width,h/size.height),dw=size.width*scale,dh=size.height*scale;
    const position=style.backgroundPosition.split(/\s+/),px=position[0]?.endsWith('%')?parseFloat(position[0])/100:.5,py=position[1]?.endsWith('%')?parseFloat(position[1])/100:.5;
    const ox=(w-dw)*px,oy=(h-dh)*py;
    return {style,map:([x,y])=>({x:ox+x*dw,y:oy+y*dh})};
  }
  function surfacePolygons(scene,mode,mobile){
    const w=scene.clientWidth,h=scene.clientHeight,plane=tableTop[mode],projection=plane&&cover(scene);
    if(projection)return [[[0,plane],[1,plane],[1,mode==='meeting'?.94:.985],[0,mode==='meeting'?.94:.985]].map(projection.map)];
    let points;
    if(mode==='outdoor'||mode==='seaside')points=[[.02,.83],[.89,.81],[.99,.99],[.01,.99]];
    else if(mode==='cafe')points=mobile?[[.08,.90],[.79,.875],[.98,.94],[.86,.999],[.17,.999],[.015,.955]]:[[.23,.84],[.78,.84],[.9,.94],[.76,.999],[.28,.999],[.14,.94]];
    else points=mobile?[[.035,.9],[.965,.9],[.995,.995],[.005,.995]]:[[.06,.83],[.94,.83],[.99,.99],[.01,.99]];
    return [points.map(([x,y])=>({x:x*w,y:y*h}))];
  }
  function foreground(scene,mode){
    const ambient=scene.querySelector(':scope > .scene-ambient:not(.scene-depth-foreground)');
    let front=scene.querySelector(':scope > .scene-depth-foreground');
    if(!outlines[mode]||!ambient){if(front)front.remove();return;}
    if(!front){front=ambient.cloneNode(false);front.classList.add('scene-depth-foreground');front.setAttribute('aria-hidden','true');scene.insertBefore(front,scene.querySelector('.pet-cast'));}
    const projection=cover(scene);if(!projection)return [];
    const {style}=projection,points=outlines[mode].map(projection.map);
    front.style.backgroundImage=style.backgroundImage;
    front.style.backgroundSize=style.backgroundSize;
    front.style.backgroundPosition=style.backgroundPosition;
    front.style.clipPath='polygon('+points.map(({x,y})=>`${x.toFixed(2)}px ${y.toFixed(2)}px`).join(',')+')';
    return points;
  }
  function refresh(scene){
    scene=scene?.nodeType===1?scene:document.getElementById('petScene');
    if(!scene)return;
    if(scene!==current){if(current&&resize)resize.unobserve(current);current=scene;if(resize)resize.observe(scene);}
    const mode=scene.dataset.sceneMode||'room',cfg=scenes[mode]||scenes.room;
    const mobile=global.matchMedia('(max-width:759px)').matches,pair=scene.classList.contains('has-guest');
    const w=scene.clientWidth,h=scene.clientHeight,servings=mobile?cfg.mobile:cfg.desktop;
    ['plate-main-x','plate-main-y','plate-guest-x','plate-guest-y','cup-x','cup-y'].forEach((name,i)=>scene.style.setProperty('--'+name,servings[i]+'%'));
    for(const [index,slot] of [...scene.querySelectorAll('#petMainSlot,#petGuestSlot')].entries()){
      const wrap=slot.querySelector('[data-posture]');if(!wrap)continue;
      const pose=wrap.dataset.posture||'stand',chair=pose.startsWith('chair-'),ground=['sit','listen','laptop','read'].includes(pose)&&!chair,lie=pose==='lie';
      const sprite=wrap.querySelector('.pet-2d-sprite');
      const sourceStyle=sprite?getComputedStyle(sprite):getComputedStyle(wrap);
      const aspect=number(sourceStyle.getPropertyValue('--sprite-aspect'),lie?1.85:chair?.66:ground?.98:.49);
      const baseline=number(sourceStyle.getPropertyValue('--sprite-height'),lie?130:chair?250:ground?165:280);
      const baseScale=(mobile?.96:1.04)*(cfg.scale||1);
      let y=(lie?(cfg.lie||cfg.ground||cfg.feet):ground?(cfg.ground||cfg.feet):chair?(cfg.chair||cfg.feet):cfg.feet)*h;
      if(mobile&&chair)y=Math.min(y,h*.94);
      const maxWidth=pair?w*(lie?.43:.45):w*(lie?.72:.55);
      const maxHeight=y-(mobile?122:112);
      const height=Math.max(70,Math.min(baseline*baseScale,maxWidth/aspect,maxHeight));
      const width=Math.max(90,Math.min(maxWidth,height*aspect+12));
      const x=pair?(mobile?[26,74]:cfg.x)[index]:50;
      slot.style.setProperty('--actor-x',x+'%');slot.style.setProperty('--actor-y',y.toFixed(1)+'px');
      slot.style.setProperty('--figure-height',height.toFixed(1)+'px');slot.style.setProperty('--figure-width',width.toFixed(1)+'px');
      wrap.style.setProperty('--figure-height',height.toFixed(1)+'px');wrap.style.setProperty('--figure-width',width.toFixed(1)+'px');
      wrap.style.setProperty('--figure-scale',(height/baseline).toFixed(4));
    }
    const foregroundPolygon=foreground(scene,mode)||[];
    geometry.set(scene,{mode,width:w,height:h,surfacePolygons:surfacePolygons(scene,mode,mobile),foregroundPolygon});
    scene.dataset.layout='v66';
  }
  function schedule(){if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;refresh();});}
  const resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
  const observer=new MutationObserver(records=>{if(records.some(r=>r.target.id==='petChar'||r.target.closest?.('#petChar')))schedule();});
  function boot(){observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-posture','class']});schedule();}
  function snapshot(scene){
    scene=scene?.nodeType===1?scene:document.getElementById('petScene');if(!scene)return null;
    const record=geometry.get(scene);if(!record)return null;
    const origin=scene.getBoundingClientRect();
    const contacts=[...scene.querySelectorAll('.scene-snack-item,.scene-cup')].map(el=>{const r=el.getBoundingClientRect(),kind=el.classList.contains('scene-cup')?'cup':'plate',x=r.left-origin.left+r.width/2,y=r.bottom-origin.top;return {kind,x,y,width:r.width,radius:kind==='plate'?r.width/2:0,footprint:kind==='plate'?[{x:x-r.width/2,y},{x,y},{x:x+r.width/2,y}]:[{x,y}]};});
    const actors=[...scene.querySelectorAll('[data-posture]')].map(el=>{const r=el.getBoundingClientRect();return {x:r.left-origin.left,y:r.top-origin.top,width:r.width,height:r.height,posture:el.dataset.posture};});
    return JSON.parse(JSON.stringify({...record,contacts,actors}));
  }
  global.MilkSceneLayout={refresh,snapshot};
  global.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('classic-room-sync',schedule);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
