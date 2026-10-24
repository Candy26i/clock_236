/* Local wall-clock times belong to the task owner's day, not the viewer's timezone. */
(function(root){
  'use strict';
  function minutes(value){
    if(typeof value!=='string'||!/^\d{2}:\d{2}$/.test(value))return null;
    const [h,m]=value.split(':').map(Number);
    return h<24&&m<60?h*60+m:null;
  }
  function time(value){return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');}
  function interval(task){
    const start=minutes(task?.schedule?.start),end=minutes(task?.schedule?.end);
    return start!==null&&end!==null&&end>start?{start,end}:null;
  }
  function overlaps(a,b){return a.start<b.end&&b.start<a.end;}
  function plan(tasks){
    const rows=tasks.map(task=>({task,...interval(task)})).filter(row=>Number.isFinite(row.start));
    rows.sort((a,b)=>a.start-b.start||a.end-b.end||String(a.task.id).localeCompare(String(b.task.id)));
    return rows.map(row=>({...row,conflicts:rows.filter(other=>other!==row&&overlaps(row,other)).map(other=>other.task.id)}));
  }
  function progress(start,end,now,done=false){return done?1:Math.max(0,Math.min(1,(now-start)/(end-start)));}
  function segments(tasks){
    const rows=plan(tasks),bounds=[...new Set(rows.flatMap(r=>[r.start,r.end]))].sort((a,b)=>a-b);
    return bounds.slice(0,-1).map((start,i)=>({start,end:bounds[i+1],tasks:rows.filter(r=>r.start<bounds[i+1]&&r.end>start).map(r=>r.task)})).filter(s=>s.tasks.length);
  }
  function phase(task,now){const r=interval(task);return !r?'unscheduled':now<r.start?'future':now<r.end?'active':task.done?'lit':'missed';}
  const api={minutes,time,interval,overlaps,plan,progress,segments,phase};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.TodoSchedule=api;
})(typeof window==='undefined'?globalThis:window);

function scheduleTodo(uid,id){
  const task=todoObjOf(uid)[id];if(!task)return;
  const dayKey=todayKeyFor(uid),existing=TodoSchedule.interval(task);
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tzOf(uid),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const now=Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value);
  const duration={easy:30,mid:45,hard:60}[task.level]||45;
  const start=existing?.start??Math.min(1438,Math.ceil(now/15)*15),end=existing?.end??Math.min(1439,start+duration);
  showModal(`<h3>⏰ 安排今天的时间</h3><p class="schedule-task-title">${escHTML(task.text)}</p><p class="schedule-zone">${escHTML(dayKey)} · ${escHTML(tzShort(uid))}</p><div class="schedule-fields"><label>开始时间<input type="time" id="scheduleStart" required value="${TodoSchedule.time(start)}"></label><label>结束时间<input type="time" id="scheduleEnd" required value="${TodoSchedule.time(end)}"></label></div><p id="scheduleHint" class="schedule-hint" aria-live="polite"></p><p id="scheduleError" role="alert"></p><div class="mbtns"><button type="button" class="btn ghost" id="clearSchedule" ${existing?'':'hidden'}>取消安排</button><button type="button" class="btn ghost" id="mNo">返回</button><button type="button" class="btn start" id="saveSchedule">保存时间</button></div>`,box=>{
    const a=box.querySelector('#scheduleStart'),b=box.querySelector('#scheduleEnd');
    const value=()=>({start:a.value,end:b.value});
    const hint=()=>{
      const range=TodoSchedule.interval({schedule:value()});
      const matches=range?todoItemsOf(uid).filter(t=>t.id!==id&&TodoSchedule.interval(t)&&TodoSchedule.overlaps(range,TodoSchedule.interval(t))):[];
      box.querySelector('#scheduleHint').textContent=matches.length?'与「'+matches.map(t=>t.text).join('」「')+'」时间重叠，可调整或保留。':range?'预计 '+(range.end-range.start)+' 分钟':'请选择当天的开始、结束时间，结束时间需晚于开始时间。';
    };
    a.oninput=b.oninput=hint;hint();a.focus();
    function save(schedule){
      const error=box.querySelector('#scheduleError');
      if(dayKey!==todayKeyFor(uid)){error.textContent='已经跨天，请关闭后安排新一天的任务。';return;}
      if(schedule&&!TodoSchedule.interval({schedule})){error.textContent='请填写有效时间，结束时间必须晚于开始时间。';return;}
      DB.txn('users/'+uid+'/days/'+dayKey+'/todos/'+id,cur=>{
        if(!cur)return undefined;
        const next={...cur};if(schedule)next.schedule=schedule;else delete next.schedule;
        return next;
      },ok=>{if(ok){closeModal();renderTodo();}else error.textContent='保存失败或任务已删除，请稍后重试。';});
    }
    box.querySelector('#saveSchedule').onclick=()=>save(value());
    box.querySelector('#clearSchedule').onclick=()=>save(null);
  });
}

function todoAlarmIcon(){
  return '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 8.5V13l3 1.8M5 3 2 6m17-3 3 3M6.5 20l-1 2m12-2 1 2M9 2h6"/></svg>';
}
function scheduleNow(uid){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tzOf(uid),hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const get=type=>Number(parts.find(p=>p.type===type).value);
  return get('hour')*60+get('minute')+get('second')/60;
}

const scheduleSelections=new Map();
const scheduleColors=[['#d5c8b7','#eab64e'],['#c5cdbd','#89bc72'],['#c0cbd0','#76b9dd'],['#d2c0c5','#e49eae'],['#cac3d4','#af94d9'],['#cfcbc0','#e3a476'],['#bfd0cb','#65bca5'],['#c9c8b0','#c5be56']];
function scheduleColor(id,lit,rows){return scheduleColors[Math.max(0,rows.findIndex(r=>r.task.id===id))%scheduleColors.length][lit?1:0];}
function scheduleNote(uid,id){
  const task=todoObjOf(uid)[id];if(!task)return;
  const dayKey=todayKeyFor(uid),original=task.note||'';
  showModal(`<h3>${escHTML(task.text)}</h3><label class="schedule-note-label">这一段的小笔记<textarea id="taskNote" maxlength="4000" rows="6" placeholder="记下进展、灵感，或下一步想做什么…">${escHTML(original)}</textarea></label><p id="noteError" role="alert"></p><div class="mbtns"><button class="btn ghost" id="mNo">取消</button><button class="btn start" id="saveTaskNote">${task.startedAt?'保存笔记':'开始并保存'}</button></div>`,box=>{
    const field=box.querySelector('#taskNote');field.focus();
    box.querySelector('#saveTaskNote').onclick=()=>{
      const note=field.value.trim();
      if(dayKey!==todayKeyFor(uid)){box.querySelector('#noteError').textContent='已经跨天，请回到今天的任务再记录。';return;}
      DB.txn('users/'+uid+'/days/'+dayKey+'/todos/'+id,cur=>{
        if(!cur||(cur.note||'')!==original)return undefined;
        return {...cur,note,startedAt:cur.startedAt||Date.now(),noteUpdatedAt:Date.now()};
      },ok=>{if(ok){closeModal();renderTodo();}else box.querySelector('#noteError').textContent='任务或笔记已发生变化，请关闭后重新打开；你的草稿仍保留在这里。';});
    };
  });
}
function scheduleStatus(task,now){
  const phase=TodoSchedule.phase(task,now);
  if(phase==='lit')return '这段时光已点亮，辛苦啦 ✨';
  if(phase==='missed')return '这段时光还差一个完成勾，做完再来点亮吧。';
  if(task.done)return '任务已完成，时间走完后，这一段就会亮起来。';
  return phase==='active'?'进行中 · 剩余 '+Math.ceil(TodoSchedule.interval(task).end-now)+' 分钟':'还没开始，可以先记下准备事项。';
}
function updateTodoJourney(){
  const host=document.getElementById('todoSchedule'),state=host?._scheduleState;if(!state)return;
  const {uid,rows,segments,dayKey}=state;if(dayKey!==todayKeyFor(uid))return;
  const now=scheduleNow(uid),rail=host.querySelector('.schedule-journey');
  rail.style.setProperty('--journey-progress',(now/14.4).toFixed(3)+'%');
  rail.classList.toggle('is-walking',rows.some(r=>now>=r.start&&now<r.end));
  host.querySelectorAll('[data-segment]').forEach(el=>{
    const part=segments[Number(el.dataset.segment)],colors=part.tasks.map(t=>scheduleColor(t.id,TodoSchedule.phase(t,now)==='lit',rows));
    el.style.background=colors.length===1?colors[0]:'linear-gradient(to bottom,'+colors.flatMap((c,i)=>[c+' '+i*100/colors.length+'%',c+' '+(i+1)*100/colors.length+'%']).join(',')+')';
    el.classList.toggle('is-lit',part.tasks.every(t=>TodoSchedule.phase(t,now)==='lit'));
  });
  const key=uid+'|'+dayKey;
  if(!rows.some(r=>r.task.id===scheduleSelections.get(key)))scheduleSelections.delete(key);
  const choice=scheduleSelections.get(key);
  const selected=rows.find(r=>r.task.id===choice)||rows.find(r=>r.start<=now&&r.end>now)||rows.find(r=>r.start>now)||rows[rows.length-1];
  const panel=host.querySelector('.schedule-detail');
  if(!selected){panel.innerHTML='<p class="schedule-empty">点任务旁的小闹钟，安排第一段同行时光。</p>';return;}
  const task=selected.task,phase=TodoSchedule.phase(task,now),signature=task.id+'|'+phase+'|'+!!task.done;
  host.querySelectorAll('[data-segment]').forEach(el=>{const chosen=segments[Number(el.dataset.segment)].tasks.some(t=>t.id===task.id);el.classList.toggle('is-selected',chosen);el.setAttribute('aria-pressed',String(chosen));});
  if(panel.dataset.signature!==signature){
    panel.dataset.signature=signature;
    panel.innerHTML=`<div class="schedule-selected-heading"><div><small>${choice?'选中的任务':phase==='active'?'当前任务':phase==='future'?'接下来':'最近一段'}</small><h4>${escHTML(task.text)} <button type="button" class="schedule-note-edit" aria-label="编辑任务笔记" title="编辑笔记">✎</button></h4></div><button type="button" class="schedule-time-edit" aria-label="调整任务时间">${TodoSchedule.time(selected.start)}–${TodoSchedule.time(selected.end)} ✎</button></div><p class="schedule-selected-status" role="status"></p>${selected.conflicts.length?'<p class="schedule-overlap">这一段有重叠安排，可从下方选择要查看的任务。</p>':''}<p class="schedule-note-preview">${task.note?escHTML(task.note):'还没有笔记，开始时记一点小想法吧。'}</p><div class="schedule-selected-actions"><button class="schedule-start" type="button">${task.startedAt?'继续记笔记':'开始 · 写笔记'}</button><button class="schedule-finish" type="button" ${task.done?'disabled':''}>${task.done?'✓ 已完成':'✓ 完成任务'} · +${todoRewardOf(task)} 金币</button></div><label class="schedule-task-select">查看任务<select aria-label="选择时间轴上的任务">${rows.map(r=>`<option value="${escHTML(r.task.id)}" ${r.task.id===task.id?'selected':''}>${TodoSchedule.time(r.start)}–${TodoSchedule.time(r.end)} · ${escHTML(r.task.text)}</option>`).join('')}</select></label>${choice?'<button class="schedule-follow-now" type="button">回到当前时段</button>':''}`;
    panel.querySelector('.schedule-note-edit').onclick=panel.querySelector('.schedule-start').onclick=()=>scheduleNote(uid,task.id);
    panel.querySelector('.schedule-time-edit').onclick=()=>scheduleTodo(uid,task.id);
    panel.querySelector('.schedule-finish').onclick=()=>completeTodo(uid,task.id);
    panel.querySelector('select').onchange=e=>{scheduleSelections.set(key,e.target.value);panel.dataset.signature='';updateTodoJourney();};
    const follow=panel.querySelector('.schedule-follow-now');if(follow)follow.onclick=()=>{scheduleSelections.delete(key);panel.dataset.signature='';updateTodoJourney();};
  }
  panel.querySelector('.schedule-selected-status').textContent=scheduleStatus(task,now);
}
function renderTodoSchedule(uid,items){
  const host=document.getElementById('todoSchedule');if(!host)return;
  const rows=TodoSchedule.plan(items),segments=TodoSchedule.segments(items),dayKey=todayKeyFor(uid),pending=items.length-rows.length;
  host.dataset.uid=uid;host._scheduleState={uid,rows,segments,dayKey};
  host.innerHTML=`<div class="schedule-heading"><h3>今天也一起慢慢来</h3><span>${rows.filter(r=>r.task.done).length} / ${rows.length} 项完成${pending?' · '+pending+' 项待安排':''}</span></div><p class="schedule-zone">${escHTML(dayKey)} · ${escHTML(tzShort(uid))}</p><div class="schedule-journey"><div class="journey-rail segmented-rail" role="group" aria-label="今日任务时间轴">${segments.map((part,i)=>`<button type="button" class="journey-segment" data-segment="${i}" style="left:${part.start/14.4}%;width:${(part.end-part.start)/14.4}%" aria-label="${escHTML(part.tasks.map(t=>t.text).join('、'))} ${TodoSchedule.time(part.start)}–${TodoSchedule.time(part.end)}" title="${escHTML(part.tasks.map(t=>t.text).join('、'))} ${TodoSchedule.time(part.start)}–${TodoSchedule.time(part.end)}"></button>`).join('')}<span class="journey-buddy ${uid==='u2'?'is-xinghui':''}" aria-hidden="true"></span><span class="journey-goal" aria-hidden="true">🎁</span></div><div class="journey-caption"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div><div class="schedule-detail"></div>`;
  host.querySelectorAll('[data-segment]').forEach(button=>button.onclick=()=>{
    const part=segments[Number(button.dataset.segment)],key=uid+'|'+dayKey;
    const current=scheduleSelections.get(key),next=part.tasks[(part.tasks.findIndex(t=>t.id===current)+1)%part.tasks.length];
    scheduleSelections.set(key,next.id);host.querySelector('.schedule-detail').dataset.signature='';updateTodoJourney();
  });
  updateTodoJourney();
}
