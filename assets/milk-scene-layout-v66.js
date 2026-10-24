/* Presentation only: no account data, timers, storage, or database access. */
(function(global){
  'use strict';
  // Serving coordinates are [main x/y, guest x/y, tea x/y], in canvas percent.
  const scenes={
    room:{feet:.78,ground:.79,chair:.96,x:[35,67],desktop:[72,94,83,94,93,96],mobile:[77,92,91,98,68,98]},
    outdoor:{feet:.82,ground:.85,lie:.89,x:[35,66],desktop:[39,91,65,91,76,92],mobile:[41,94,65,94,80,95]},
    cafe:{feet:.96,chair:1.01,x:[38,65],desktop:[48,88,67,91,79,92],mobile:[51,93,68,93,83,94]},
    library:{feet:.86,chair:.97,x:[36,65],desktop:[72,94,83,94,93,96],mobile:[77,92,91,98,68,98]},
    meeting:{feet:.99,chair:1.025,x:[36,65],scale:1,desktop:[69,83,79,83,90,91],mobile:[83,82,83,92,94,88]},
    studio:{feet:.91,chair:1.0,x:[35,66],desktop:[68,86,79,86,90,93],mobile:[82,90,91,98,24,98]},
    greenhouse:{feet:.77,chair:.92,x:[30,70],desktop:[54,76,69,76,80,95],mobile:[47,73,68,74,88,80]},
    terrace:{feet:.79,chair:.95,x:[36,65],desktop:[66,91,77,91,88,95],mobile:[90,88,90,98,9,96]},
    train:{feet:.91,chair:.99,x:[36,66],desktop:[54,84,64,84,55,95],mobile:[54,84,73,84,87,96]},
    seaside:{feet:.8,ground:.87,lie:.89,x:[33,68],desktop:[40,90,61,90,72,92],mobile:[42,94,65,94,81,95]},
    jiangnan:{feet:.88,chair:.99,x:[35,66],desktop:[72,88,83,89,93,92],mobile:[25,94,85,94,54,96]},
    cloudrealm:{feet:.77,chair:.93,x:[35,66],desktop:[69,92,84,92,77,95],mobile:[73,98,91,98,53,98]}
  };
  // Foreground outlines in the unchanged source image's normalized coordinates.
  // The notch follows the laptop silhouette; CSS maps the source's cover crop at every width.
  const outlines={
    // Trace the round table's outer ellipse, including its carved apron.
    greenhouse:Array.from({length:65},(_,i)=>{const t=Math.PI+i*Math.PI*2/64;return [.5+.442*Math.cos(t),.846+.202*Math.sin(t)];}),
    terrace:[[0,.868],[1,.868],[1,1],[0,1]],
    jiangnan:[[0,.758],[.426,.758],[.430,.740],[.445,.738],[.452,.758],[1,.758],[1,1],[0,1]],
    cloudrealm:[[0,.800],[.436,.800],[.437,.767],[.472,.757],[.488,.800],[1,.800],[1,1],[0,1]],
    meeting:[[0,.777],[.427,.777],[.426,.718],[.431,.706],[.610,.706],[.617,.713],[.617,.777],[1,.777],[1,1],[0,1]],
    studio:[[0,.830],[.412,.830],[.411,.760],[.417,.750],[.580,.750],[.585,.757],[.584,.830],[1,.830],[1,1],[0,1]],
    train:[[0,.777],[.230,.777],[.225,.714],[.230,.699],[.464,.699],[.472,.705],[.471,.777],[.740,.777],[.748,.745],[.813,.737],[.831,.753],[.835,.777],[1,.777],[1,1],[0,1]]
  };
  // Contact planes were traced from the unmodified background/table art. They intentionally
  // exclude the floor; source-space planes follow the same cover crop as the image.
  // Approximate eye-level line of each painted camera (fraction of canvas height).
  const horizons={room:.42,outdoor:.40,cafe:.40,library:.42,meeting:.40,studio:.40,greenhouse:.40,terrace:.40,train:.40,seaside:.36,jiangnan:.40,cloudrealm:.40};
  const nearness={room:1.15,outdoor:1.16,cafe:1.12,library:1.15,meeting:1.12,studio:1.14,greenhouse:1.14,terrace:1.15,train:1.13,seaside:1.16,jiangnan:1.14,cloudrealm:1.14};
  // Contact lines (fraction of canvas height) on the picnic mat, set back from the front edge,
  // plus the figure height per posture family and the front-of-mat line where plates rest.
  const picnic={
    outdoor:{desktop:{stand:.845,ground:.845,lie:.865},mobile:{stand:.915,ground:.92,lie:.935},size:{stand:.69,ground:.57,lie:.48},plate:{desktop:.94,mobile:.975},cup:{desktop:.945,mobile:.975}},
    seaside:{desktop:{stand:.85,ground:.85,lie:.87},mobile:{stand:.9,ground:.905,lie:.925},size:{stand:.67,ground:.56,lie:.47},plate:{desktop:.945,mobile:.97},cup:{desktop:.95,mobile:.97}}
  };
  // Where the table edge crosses each posture family (fraction of the figure from the top of the
  // head), and how tall the figure is when seated right behind the table (fraction of canvas height).
  const tableCut={stand:.56,chair:.62,ground:.8};
  const behindTable={desktop:{stand:1.0,chair:.8,ground:.62},mobile:{stand:.86,chair:.72,ground:.55}};
  // Top-edge profiles of the separately painted furniture images (fraction of image height).
  const furnitureEdge={
    desk:{selector:'.scene-furniture-layer.is-desk .scene-furniture-art',edge:()=>.384,alignY:1},
    cafe:{selector:'.cafe-table-foreground .cafe-study-table',edge:u=>.203+.75*Math.pow(Math.min(.82,Math.max(.18,u))-.5,2),alignY:.5}
  };
  function occluderTop(scene,mode,xPx){
    if(mode==='greenhouse'){
      const projection=cover(scene);if(!projection)return null;
      const origin=projection.map([0,0]),unit=projection.map([1,1]);
      const u=(xPx-origin.x)/(unit.x-origin.x);
      const v=.846-.202*Math.sqrt(Math.max(0,1-Math.pow((u-.5)/.442,2)));
      return projection.map([u,v]).y;
    }
    const plane=tableTop[mode];
    if(plane){const projection=cover(scene);return projection?projection.map([.5,plane]).y:null;}
    for(const key of ['cafe','desk']){
      const spec=furnitureEdge[key],img=scene.querySelector(spec.selector);
      if(!img||!img.getClientRects().length||getComputedStyle(img).display==='none'||getComputedStyle(img.parentElement).display==='none')continue;
      if(!img.naturalWidth){img.addEventListener('load',schedule,{once:true});return null;}
      const sr=scene.getBoundingClientRect(),r=img.getBoundingClientRect();
      const scale=Math.min(r.width/img.naturalWidth,r.height/img.naturalHeight),pw=img.naturalWidth*scale,ph=img.naturalHeight*scale;
      const left=r.left-sr.left+(r.width-pw)/2,top=r.top-sr.top+(r.height-ph)*spec.alignY;
      return top+spec.edge((xPx-left)/pw)*ph;
    }
    return null;
  }
  const tableTop={meeting:.777,studio:.830,terrace:.868,train:.777,jiangnan:.758,cloudrealm:.800};
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
    if(mode==='greenhouse'){
      const projection=cover(scene);
      if(projection)return [Array.from({length:65},(_,i)=>{const t=Math.PI+i*Math.PI*2/64;return projection.map([.5+.412*Math.cos(t),.84+.182*Math.sin(t)]);})];
    }
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
    const {style}=projection;
    // The low laptop stays inside the table silhouette; no raised screen mask is needed.
    const outline=outlines[mode];
    const points=outline.map(projection.map);
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
      const pose=wrap.dataset.layoutPosture||wrap.dataset.posture||'stand',chair=pose.startsWith('chair-'),ground=['sit','listen','laptop'].includes(pose)&&!chair,lie=pose==='lie'||pose==='prone';
      const sprite=wrap.querySelector('.pet-2d-sprite');
      const sourceStyle=sprite?getComputedStyle(sprite):getComputedStyle(wrap);
      const aspect=number(sourceStyle.getPropertyValue('--sprite-aspect'),lie?1.85:chair?.66:ground?.98:.49);
      // A shared posture envelope prevents the wider artwork from shrinking just one person.
      const fitAspect=lie?2.09:chair?.69:ground?.76:.43;
      const baseline=lie?140:chair?250:ground?170:280;
      // Enlarge around the fixed ground contact, with modest per-scene perspective limits.
      const closeness=({room:1.13,outdoor:1.15,cafe:1.10,library:1.10,meeting:1.12,studio:1.09,greenhouse:1.08,terrace:1.08,train:1.10,seaside:1.12,jiangnan:1.10,cloudrealm:1.08})[mode]||1.08;
      const baseScale=(mobile?.96:1.04)*(cfg.scale||1)*(pair?1+(closeness-1)*.5:closeness);
      let y=(lie?(cfg.lie||cfg.ground||cfg.feet):ground?(cfg.ground||cfg.feet):chair?(cfg.chair||cfg.feet):cfg.feet)*h;
      if(mobile&&chair)y=Math.min(y,h*.94);
      if(mobile&&mode==='outdoor')y=h*(lie?.94:ground?.92:.91);
      if(mobile&&mode==='seaside')y=h*(lie?.93:ground?.91:.89);
      const widePair=pair&&!!scene.querySelector('[data-posture=lie],[data-posture=prone]');
      const positions=widePair?(mobile?[46,54]:[65,35]):mobile?[27,73]:cfg.x;
      const separation=pair?(positions[1]-positions[0])/100*w:w;
      const maxWidth=widePair?w*(lie?(mobile?.88:.58):.46):pair?Math.min(w*.43,separation-18):w*(lie?.86:.55);
      const maxHeight=y-(mobile?122:112);
      let height=Math.max(24,Math.min(baseline*baseScale,maxWidth/fitAspect,maxHeight));
      // Bring the companion a step closer to the viewer. Size and contact move together along the
      // floor's perspective (toward the horizon line), so feet, seat or body stay on the same floor,
      // rug or mat and the traced table/desk layers keep covering whatever is behind them.
      const horizon=h*(horizons[mode]||.42);
      const near=pair?(mobile?1.03:1.07):(mobile?1.08:(nearness[mode]||1.15));
      const nearY=horizon+(y-horizon)*near;
      const floorLimit=h*(lie?(mobile?.975:.97):chair?1.06:ground?(mobile?.975:.95):1.02);
      const contact=Math.min(nearY,Math.max(y,floorLimit));
      const reach=(contact-horizon)/Math.max(1,y-horizon);
      height=Math.max(24,Math.min(height*reach,(maxWidth*(pair?1:1.08))/fitAspect,contact-(mobile?126:44)));
      y=contact;
      // Picnic scenes: the companion settles a little further back on the mat and a little larger,
      // so the strip of mat in front of them stays free for the snack plate and the cup.
      const mat=picnic[mode];
      if(mat){
        const key=lie?'lie':ground?'ground':'stand';
        y=h*mat[mobile?'mobile':'desktop'][key];
        const target=h*mat.size[key]*(pair?.9:1)*(mobile?.94:1);
        height=Math.max(24,Math.min(target,(maxWidth*(pair?1:1.08))/fitAspect,y-(mobile?126:44)));
      }
      let x=pair?positions[index]:50;
      // Table and desk scenes: the companion sits (or stands) right behind the painted table. Getting
      // "closer" means the table edge crosses the body lower down the figure - lap for a chair, hips
      // when standing, knees on the rug - so a larger figure hides more leg instead of rising up.
      const edge=mat||lie?null:occluderTop(scene,mode,w*x/100);
      if(edge){
        const family=chair?'chair':ground?'ground':'stand';
        const size=behindTable[mobile?'mobile':'desktop'][family]*(pair?(mobile?.84:.9):1);
        const minTop=mobile?126:(pair?62:38);
        height=Math.max(24,Math.min(h*size,(edge-minTop)/tableCut[family],(maxWidth*(pair?1:1.08))/fitAspect));
        y=edge+height*(1-tableCut[family]);
      }
      // Standing companions take a small step back along the painted floor perspective.
      if(!chair&&!ground&&!lie){
        const retreat=.9;
        height*=retreat;
        y=horizon+(y-horizon)*retreat;
      }else if(lie){
        // Resting figures keep their contact with the mat while occupying less of the scene.
        height*=.92;
      }
      // Wide reclining art needs body length, not the narrow seated-person lane. Arrange
      // companions in two depth rows on grass/the mat instead of miniaturizing both.
      if(widePair&&mat){
        const wraps=[...scene.querySelectorAll('#petMainSlot [data-posture],#petGuestSlot [data-posture]')];
        const bothRest=wraps.every(el=>['lie','prone'].includes(el.dataset.posture));
        const front=bothRest?index===1:lie;
        height=lie?Math.min(maxWidth/fitAspect,h*.34):Math.min(height,h*.32);
        y=h*(front?(mobile?.89:.94):(mobile?.66:.77));
        x=mobile?(bothRest?positions[index]:50):(front?35:65);
      }
      // At this close bistro table, both figures share one anatomical scale. A seated
      // body is hidden at the lap and sits lower; it is not independently miniaturized.
      if(mode==='greenhouse'&&edge){
        const headRatio=number(sourceStyle.getPropertyValue('--sprite-head-ratio'),.256);
        const headSize=Math.min(h*.22,maxWidth/.69*.256,(edge-(mobile?130:72))/2.2);
        height=headSize/headRatio;
        const visibleHeads=chair||ground?(wrap.dataset.scene3d==='u2'?2.05:1.95):2.2;
        y=edge+height-headSize*visibleHeads;
      }
      const width=Math.max(90,Math.min(maxWidth,height*aspect+12));
      slot.style.setProperty('--actor-x',x+'%');slot.style.setProperty('--actor-y',y.toFixed(1)+'px');
      slot.style.setProperty('--figure-height',height.toFixed(1)+'px');slot.style.setProperty('--figure-width',width.toFixed(1)+'px');
      wrap.style.setProperty('--figure-height',height.toFixed(1)+'px');wrap.style.setProperty('--figure-width',width.toFixed(1)+'px');
      wrap.style.setProperty('--figure-scale',(height/baseline).toFixed(4));
      const bubble=slot.querySelector('.pet-bubble');
      if(bubble){
        const center=w*x/100,actorLeft=center-width/2,actorTop=y-height;
        let bubbleWidth=Math.min(mobile?140:190,w-24),left=center-bubbleWidth/2,top=actorTop-60;
        const controls=scene.querySelector('.scene-pose-controls');
        const sr=scene.getBoundingClientRect(),cr=controls?.getBoundingClientRect();
        const controlBottom=cr?cr.bottom-sr.top:110;
        if(top<controlBottom+8){
          if(mobile){
            // At standing height, use the free side of the head below the controls.
            top=controlBottom+8;
            const toLeft=index===1;
            const available=toLeft?center-width*.38-20:w-center-width*.38-20;
            bubbleWidth=Math.min(bubbleWidth,Math.max(86,available));
            left=toLeft?center-width*.38-bubbleWidth-8:center+width*.38+8;
          }else{
            top=Math.max(68,top);
            if(cr)left=Math.min(left,cr.left-sr.left-bubbleWidth-10);
          }
        }
        left=Math.max(10,Math.min(w-bubbleWidth-10,left));
        bubble.style.setProperty('--bubble-left',(left-actorLeft).toFixed(1)+'px');
        bubble.style.setProperty('--bubble-top',(top-actorTop).toFixed(1)+'px');
        bubble.style.setProperty('--bubble-width',bubbleWidth.toFixed(1)+'px');
      }
    }
    const mat=picnic[mode];
    if(mat){
      // Each plate sits on the mat directly in front of its own companion; the cup beside the host.
      const slots=[...scene.querySelectorAll('#petMainSlot,#petGuestSlot')].filter(slot=>!slot.hidden&&slot.querySelector('[data-posture]'));
      const xs=slots.map(slot=>parseFloat(slot.style.getPropertyValue('--actor-x'))||50);
      const plateY=mat.plate[mobile?'mobile':'desktop']*100,cupY=mat.cup[mobile?'mobile':'desktop']*100;
      const mainX=xs[0]??50,guestX=xs[1]??Math.min(88,mainX+16);
      const hostWide=slots[0]?.querySelector('[data-posture]')?.dataset.posture;
      const hostHalf=(parseFloat(slots[0]?.style.getPropertyValue('--figure-width'))||0)/2/Math.max(1,w)*100;
      let plateMain,plateGuest,cup;
      if(pair&&scene.querySelector('[data-posture=lie],[data-posture=prone]')){plateMain=mobile?54:70;plateGuest=mobile?78:80;cup=mobile?12:92;}
      else if(pair){plateMain=mainX;plateGuest=guestX;cup=Math.min(92,guestX+13);}
      else if(mobile){
        // A phone frame has little mat in front of the figure: the plate goes beside the companion's knee.
        plateMain=Math.min(84,mainX+hostHalf*.78);plateGuest=Math.max(16,mainX-hostHalf*.78);cup=Math.min(92,plateMain+10);
      }else{
        const spread=['lie','prone'].includes(hostWide)?-9:-11;
        plateMain=mainX+spread;plateGuest=plateMain+9;cup=mainX+12;
      }
      scene.style.setProperty('--plate-main-x',plateMain.toFixed(1)+'%');scene.style.setProperty('--plate-main-y',plateY+'%');
      scene.style.setProperty('--plate-guest-x',plateGuest.toFixed(1)+'%');scene.style.setProperty('--plate-guest-y',plateY+'%');
      scene.style.setProperty('--cup-x',cup.toFixed(1)+'%');scene.style.setProperty('--cup-y',cupY+'%');
    }
    // Fit the enlarged servings onto the painted contact plane, with a gap between each.
    const polygons=surfacePolygons(scene,mode,mobile),polygon=polygons[0];
    const plateSize=mobile?42:56,cupSize=mode==='greenhouse'?(mobile?66:86):(mobile?50:66);
    const top=mode==='greenhouse'?Math.min(...polygon.map(p=>p.y)):Math.max(...polygon.slice(0,2).map(p=>p.y));
    const bottom=Math.min(h-8,Math.max(...polygon.map(p=>p.y))-8);
    const items=[['plate-main',plateSize],['plate-guest',plateSize],['cup',cupSize]];
    let previousRight=0;
    for(const [i,[key,size]] of items.entries()){
      let y=parseFloat(scene.style.getPropertyValue('--'+key+'-y'))/100*h-(mat?4:7);
      y=Math.max(top+(key==='cup'?12:plateSize*.35+6),Math.min(bottom,y));
      // Intersect the surface polygon at the contact line to respect curved/cropped tables.
      const crossings=[];
      polygon.forEach((a,j)=>{const b=polygon[(j+1)%polygon.length];if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))crossings.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));});
      const left=Math.max(8,Math.min(...crossings)),right=Math.min(w-8,Math.max(...crossings));
      const requested=parseFloat(scene.style.getPropertyValue('--'+key+'-x'))/100*w;
      const remaining=items.slice(i+1).reduce((n,item)=>n+item[1]+8,0);
      // On phones, use the individually art-directed staggered arrangement: a single
      // horizontal row would push plates over the painted laptop or book.
      const x=mobile?Math.max(left+size/2,Math.min(right-size/2,requested)):
        Math.max(left+size/2,previousRight+8+size/2,Math.min(right-size/2-remaining,requested));
      previousRight=x+size/2;
      scene.style.setProperty('--'+key+'-x',x.toFixed(1)+'px');
      scene.style.setProperty('--'+key+'-y',y.toFixed(1)+'px');
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
