'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const base='http://127.0.0.1:4189/';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1100},serviceWorkers:'block'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 await context.routeWebSocket('**/*',socket=>socket.close());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base);await page.waitForFunction(()=>typeof DB!=='undefined'&&DB.demo&&document.querySelector('#todoSchedule'));
  await page.evaluate(()=>{
   view='u1';DB.set('users/u1/tz','America/Los_Angeles');DB.set('users/u2/tz','Asia/Shanghai');
   DB.set('users/u1/days/'+todayKeyFor('u1')+'/todos',{a:{text:'阅读文献',level:'mid',createdTs:1},b:{text:'整理实验笔记',level:'easy',createdTs:2},c:{text:'写报告',level:'hard',createdTs:3}});
   DB.set('users/u2/days/'+todayKeyFor('u2')+'/todos',{other:{text:'另一位的任务',done:false}});renderTodo();
  });
  const alarm=id=>page.locator('[data-todo-id="'+id+'"] .todo-alarm');
  async function setTime(id,start,end){await alarm(id).click();await page.locator('#scheduleStart').fill(start);await page.locator('#scheduleEnd').fill(end);await page.locator('#saveSchedule').click();}
  // Closing either modal must discard drafts, including an unchanged draft.
  const initial=await page.evaluate(()=>JSON.stringify(todoObjOf('u1')));
  for(const changed of [false,true]){
   await page.locator('[data-todo-id="a"] .todo-edit').click();
   if(changed)await page.locator('#editTodoText').fill('不会保存的草稿');
   await page.locator('#mNo').click();assert.equal(await page.locator('#modalWrap').isVisible(),false);
   await alarm('a').click();
   if(changed)await page.locator('#scheduleStart').fill('05:00');
   await page.locator('#mNo').click();assert.equal(await page.locator('#modalWrap').isVisible(),false);
   assert.equal(await page.evaluate(()=>JSON.stringify(todoObjOf('u1'))),initial);
  }
  assert.equal(await alarm('a').locator('svg').count(),1);
  assert.match(await alarm('a').getAttribute('aria-label'),/未安排/);
  await setTime('a','09:00','10:00');
  await page.waitForFunction(()=>todoObjOf('u1').a.schedule?.start==='09:00');
  assert.match(await alarm('a').getAttribute('aria-label'),/已安排/);
  await setTime('b','09:30','10:30');
  assert.equal(await page.locator('.schedule-bar.has-conflict').count(),2);
  await setTime('c','14:00','13:00');assert.match(await page.locator('#scheduleError').innerText(),/结束时间/);
  await page.locator('#scheduleEnd').fill('15:00');await page.locator('#saveSchedule').click();
  assert.equal(await page.locator('.schedule-row').count(),3);
  const beforeReward=await page.evaluate(()=>coinsOf('u1'));
  // Time passing updates presentation only; checked completion grants exactly once.
  await page.evaluate(()=>{updateTodoJourney();updateTodoJourney();});
  assert.equal(await page.evaluate(()=>coinsOf('u1')),beforeReward);
  await page.locator('[data-complete-id="a"]').click();
  await page.waitForFunction(()=>todoObjOf('u1').a.done===true);
  const coins=await page.evaluate(()=>coinsOf('u1'));
  assert.equal(coins,beforeReward+5);
  await page.evaluate(()=>completeTodo('u1','a'));
  assert.equal(await page.evaluate(()=>coinsOf('u1')),coins);
  assert.equal(await page.locator('[data-complete-id="a"]').isDisabled(),true);
  await setTime('a','08:00','09:00');
  assert.equal(await page.evaluate(()=>coinsOf('u1')),coins);
  assert.equal(await page.locator('.schedule-row.is-done').count(),1);
  await page.locator('[data-todo-id="a"] .todo-edit').click();await page.locator('#editTodoText').fill('阅读两篇文献');await page.locator('#saveTodoEdit').click();
  assert.equal(await page.evaluate(()=>todoObjOf('u1').a.schedule.start),'08:00');
  // Demo storage is intentionally memory-only. Replay the persisted day snapshot as
  // a database subscription would after reload; do not contact the production store.
  const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(data)));
  await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB.demo);
  await page.evaluate(saved=>{for(const uid of ['u1','u2']){DB.set('users/'+uid+'/tz',saved[uid].tz);DB.set('users/'+uid+'/days',saved[uid].days);}view='u1';renderTodo();},saved);
  assert.equal(await page.locator('.schedule-row').count(),3);
  await page.locator('#todoSchedule').screenshot({path:path.resolve(__dirname,'../artifacts/todo-schedule-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#todoList').screenshot({path:path.resolve(__dirname,'../artifacts/todo-alarms-mobile.png')});
  await page.locator('#todoSchedule').screenshot({path:path.resolve(__dirname,'../artifacts/todo-schedule-mobile.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await alarm('b').click();await page.locator('#clearSchedule').click();
  assert.equal(await page.locator('.schedule-row').count(),2);
  await alarm('c').click();await page.evaluate(()=>deleteTodo('u1','c'));await page.locator('#saveSchedule').click();
  assert.match(await page.locator('#scheduleError').innerText(),/删除/);assert.equal(await page.evaluate(()=>todoObjOf('u1').c),undefined);
  await page.evaluate(()=>{closeModal();view='u2';renderTodo();});
  assert.equal(await page.locator('.schedule-row').count(),0);assert.match(await page.locator('#todoList').innerText(),/另一位/);
  assert.deepEqual(errors,[]);
  console.log('Schedule UI passed: save/edit/clear, reload, overlap, invalid time, completion rewards, deleted task, timezone/account isolation, mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
