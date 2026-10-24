const assert=require('node:assert/strict');
const {minutes,interval,plan,progress}=require('../assets/todo-schedule.js');
assert.equal(minutes('00:00'),0);assert.equal(minutes('23:59'),1439);
for(const bad of ['24:00','12:60','9:00','',null,'-1:30'])assert.equal(minutes(bad),null);
assert.equal(interval({schedule:{start:'14:00',end:'13:00'}}),null);
assert.equal(interval({schedule:{start:'14:00',end:'14:00'}}),null);
const tasks=[{id:'c',schedule:{start:'10:00',end:'10:30'}},{id:'b',schedule:{start:'09:30',end:'10:15'}},{id:'a',schedule:{start:'09:00',end:'10:00'}},{id:'none'},{id:'bad',schedule:{start:'x',end:'y'}}];
const before=JSON.stringify(tasks),rows=plan(tasks);
assert.deepEqual(rows.map(r=>r.task.id),['a','b','c']);
assert.deepEqual(rows.map(r=>r.conflicts),[['b'],['a','c'],['b']]);
assert.equal(JSON.stringify(tasks),before);
console.log('Schedule validation, chronological order, touching boundaries and overlap checks passed.');

assert.equal(progress(540,600,530),0);
assert.equal(progress(540,600,570),.5);
assert.equal(progress(540,600,610),1);
assert.equal(progress(540,600,530,true),1);
console.log('Journey progress passed: before, during, after, and checked completion.');

const {segments,phase}=require('../assets/todo-schedule.js');
assert.deepEqual(segments(tasks).map(s=>[s.start,s.end,s.tasks.map(t=>t.id)]),[
 [540,570,['a']],[570,600,['a','b']],[600,615,['b','c']],[615,630,['c']]
]);
const task={schedule:{start:'09:00',end:'10:00'}};
assert.equal(phase(task,539),'future');
assert.equal(phase(task,540),'active');
assert.equal(phase(task,600),'missed');
assert.equal(phase({...task,done:true},599),'active');
assert.equal(phase({...task,done:true},600),'lit');
assert.deepEqual(segments([]),[]);
assert.equal(segments([{id:'a',schedule:{start:'09:00',end:'10:00'}},{id:'b',schedule:{start:'11:00',end:'12:00'}}]).length,2);
console.log('Single-axis segmentation passed: overlaps, gaps, empty day, and elapsed + completed lighting gate.');
