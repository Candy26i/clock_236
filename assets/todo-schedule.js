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
  const api={minutes,time,interval,overlaps,plan,progress};
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
function updateTodoJourney(){
  const host=document.getElementById('todoSchedule');if(!host?.dataset.uid)return;
  const now=scheduleNow(host.dataset.uid);
  host.querySelectorAll('[data-start]').forEach(el=>{
    const start=Number(el.dataset.start),end=Number(el.dataset.end),done=el.dataset.done==='true';
    const progress=TodoSchedule.progress(start,end,now,done);
    el.style.setProperty('--journey-progress',(progress*100).toFixed(2)+'%');
    el.classList.toggle('is-walking',!done&&now>=start&&now<end);
    const status=el.querySelector('[data-progress-label]');
    if(status)status.textContent=done?'已完成 · 奖励已领取':now<start?'还没开始 · 慢慢准备':now<end?'进行中 · 剩余 '+Math.ceil(end-now)+' 分钟':'时间到啦 · 完成后勾选领取奖励';
    if(el.getAttribute('role')==='progressbar')el.setAttribute('aria-valuenow',String(Math.round(progress*100)));
  });
}
function renderTodoSchedule(uid,items){
  const host=document.getElementById('todoSchedule');if(!host)return;
  host.dataset.uid=uid;
  const rows=TodoSchedule.plan(items),pending=items.length-rows.length,done=rows.filter(r=>r.task.done).length;
  const start=rows[0]?.start??0,end=rows.length?Math.max(...rows.map(r=>r.end)):1440;
  host.innerHTML=`<div class="schedule-heading"><h3>今天也一起慢慢来</h3><span>${done} / ${rows.length} 项完成${pending?' · '+pending+' 项待安排':''}</span></div><p class="schedule-zone">${escHTML(todayKeyFor(uid))} · ${escHTML(tzShort(uid))}</p>`+(rows.length?`
    <div class="schedule-journey" data-start="${start}" data-end="${end}" data-done="${done===rows.length}" role="progressbar" aria-label="今日安排的时间进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="journey-rail"><span class="journey-fill"></span><span class="journey-buddy ${uid==='u2'?'is-xinghui':''}" aria-hidden="true"></span><span class="journey-goal" aria-hidden="true">✦</span></div>
      <div class="journey-caption"><span>${TodoSchedule.time(start)} 出发</span><span>${TodoSchedule.time(end)} 抵达</span></div>
    </div><p class="journey-note">搭子跟着时间前进，勾选完成收下金币。每项奖励只领取一次。</p>
    <div class="schedule-axis" aria-hidden="true"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div><ol class="schedule-rows">${rows.map(({task,start,end,conflicts})=>`<li class="schedule-row ${task.done?'is-done':''}" data-start="${start}" data-end="${end}" data-done="${!!task.done}">
      <button class="schedule-edit" type="button" data-schedule-id="${escHTML(task.id)}" aria-label="调整 ${escHTML(task.text)} 的时间"><span class="schedule-label"><span>${task.done?'✓ ':''}${escHTML(task.text)}</span><span class="schedule-time">${TodoSchedule.time(start)}–${TodoSchedule.time(end)}${conflicts.length?' · 时间重叠':''}</span></span><span class="schedule-track" aria-hidden="true"><span class="schedule-bar ${conflicts.length?'has-conflict':''}" style="left:${start/14.4}%;width:${(end-start)/14.4}%"><span class="schedule-elapsed"></span></span></span></button>
      <div class="schedule-row-footer"><span data-progress-label></span><button class="schedule-reward" type="button" data-complete-id="${escHTML(task.id)}" ${task.done?'disabled':''} aria-label="${task.done?'已完成':'完成'} ${escHTML(task.text)}">${task.done?'已收下':'✓ 完成'} · +${todoRewardOf(task)} 金币</button></div></li>`).join('')}</ol>`:'<p class="schedule-empty">点任务旁的红色小闹钟，安排今天的第一段同行时光。</p>');
  host.querySelectorAll('[data-schedule-id]').forEach(button=>button.onclick=()=>scheduleTodo(uid,button.dataset.scheduleId));
  host.querySelectorAll('[data-complete-id]').forEach(button=>button.onclick=()=>completeTodo(uid,button.dataset.completeId));
  updateTodoJourney();
}
