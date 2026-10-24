'use strict';
// Execute the real modal handlers with a small DOM adapter, without browser/network access.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const task={text:'原任务',level:'mid',schedule:{start:'09:00',end:'10:00'}};
const wrap={hidden:true};let writes=0;
const box={className:'',elements:{},querySelector(selector){return this.elements[selector.slice(1)]||null;}};
Object.defineProperty(box,'innerHTML',{set(markup){
 this.elements={};
 for(const match of markup.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){
  this.elements[match[1]]={value:match[0].match(/\bvalue="([^"]*)"/)?.[1]||'',textContent:'',focus(){}};
 }
}});
const context=vm.createContext({console,Intl,Date,setTimeout,clearTimeout,
 document:{getElementById:id=>id==='modalWrap'?wrap:box},
 todoObjOf:()=>({a:task}),todayKeyFor:()=> '2026-10-24',tzOf:()=> 'Asia/Shanghai',tzShort:()=> '上海',
 todoItemsOf:()=>[{id:'a',...task}],escHTML:x=>String(x),
 TODO_LEVELS:{mid:{em:'',label:'日常'}},todoRewardOf:()=>5,todoLevelOf:()=>({reward:5}),
 DB:{txn(){writes++;}},renderTodo(){}
});
vm.runInContext(html.slice(html.indexOf('function showModal('),html.indexOf('// 方向三:')),context);
vm.runInContext(html.slice(html.indexOf('function editTodo('),html.indexOf('function deleteTodo(')),context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/todo-schedule.js'),'utf8'),context);
for(const fn of ['editTodo','scheduleTodo']){
 for(const changed of [false,true]){
  context[fn]('u1','a');assert.equal(wrap.hidden,false);
  if(changed)box.querySelector(fn==='editTodo'?'#editTodoText':'#scheduleStart').value='draft';
  assert.equal(typeof box.querySelector('#mNo').onclick,'function');
  box.querySelector('#mNo').onclick();assert.equal(wrap.hidden,true);
  assert.equal(writes,0,'Cancel must never persist a draft');
 }
}
// Existing callers can still override the default cancel action.
let custom=0;context.showModal('<button id="mNo"></button>',box=>box.querySelector('#mNo').onclick=()=>custom++);
box.querySelector('#mNo').onclick();assert.equal(custom,1);
assert.equal(task.text,'原任务');assert.equal(task.schedule.start,'09:00');
console.log('Real edit/time modal handlers: unchanged/changed cancel closes without writes; custom handlers preserved.');

// Notes preserve task time/completion and do not write on cancel or resurrect deleted tasks.
context.scheduleNote('u1','a');box.querySelector('#taskNote').value='draft';
box.querySelector('#mNo').onclick();assert.equal(writes,0);assert.equal(wrap.hidden,true);
let persisted={...task,done:true,earned:5},committed=false;
context.DB.txn=(path,update,callback)=>{const next=update(persisted);committed=!!next;if(next)persisted=next;callback(committed);};
context.scheduleNote('u1','a');box.querySelector('#taskNote').value='  今天的重点  ';
box.querySelector('#saveTaskNote').onclick();assert.equal(persisted.note,'今天的重点');
assert.equal(persisted.done,true);assert.equal(persisted.earned,5);assert.equal(persisted.schedule.start,'09:00');assert.ok(persisted.startedAt);
context.scheduleNote('u1','a');persisted=null;box.querySelector('#saveTaskNote').onclick();assert.equal(committed,false);assert.equal(wrap.hidden,false);
assert.match(box.querySelector('#noteError').textContent,/变化/);
console.log('Notes passed: cancel, save, preserve task fields, and deleted-task protection.');
