const CHEV='<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>';
const TICK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>';

/* ═══════════ storage ═══════════ */
const K=CFG.key, KB=K+'blockStart', KS=K+'sessions';
const dk=d=>(d||new Date()).toISOString().slice(0,10);
const J=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch(e){return f}};
const W=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){toast('Storage full')}};

const getEx=id=>J(K+id,[]);
function logSet(id,i,w,r){
  const a=getEx(id), d=dk();
  let e=a.find(x=>x.d===d);
  if(!e){e={d,sets:[],ts:[]};a.push(e)}
  e.sets[i]={w:+w||0,r:+r||0};
  e.ts[i]=Date.now();
  W(K+id,a);
}
function unlogSet(id,i){
  const a=getEx(id), d=dk(), e=a.find(x=>x.d===d);
  if(!e)return;
  delete e.sets[i]; delete e.ts[i];
  if(!e.sets.filter(Boolean).length){a.splice(a.indexOf(e),1)}
  W(K+id,a);
}
const today=d=>getEx(d).find(x=>x.d===dk());
/* every log of this exercise, whatever id it was saved under */
function logsFor(id){const n=exName(id),out=[];
  allIds().forEach(k=>{if(k===id||exName(k)===n)out.push(...getEx(k))});
  if(!out.length)out.push(...getEx(id));
  return out.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0)}
function prev(id){const a=logsFor(id),d=dk();for(let i=a.length-1;i>=0;i--)if(a[i].d!==d&&a[i].sets.filter(Boolean).length)return a[i];return null}
const n1=v=>Math.round(v*10)/10;
function fmtSets(e){
  const s=e.sets.filter(Boolean);
  if(!s.length)return '—';
  const w=[...new Set(s.map(x=>x.w))], r=s.map(x=>x.r);
  const ws=w.length===1?n1(w[0]):n1(Math.min(...w))+'–'+n1(Math.max(...w));
  if(r.every(x=>!x))return ws+' kg';                       // imported weight-only log
  return (w.length===1&&w[0]===0?'BW':ws+' kg')+' × '+r.join('/');
}
function fmtD(d){const t=new Date(d+'T12:00:00');
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.getDay()]+' '+t.getDate()+' '+
  ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][t.getMonth()]}
/* earned the increment? every set at or above the top of the range */
function earned(ex){
  const e=today(ex.id)||prev(ex.id); if(!e)return false;
  const s=e.sets.filter(Boolean);
  if(s.length<ex.s)return false;
  const top=+ex.r.split(/[–-]/)[1];
  return s.every(x=>x.r>=top);
}

const KBW=K+'bw', SCALE=30;
const KV=K+'var:';
/* A swap is for today only: the station was taken TODAY. A swap that stuck
   around put next week's card on the alternate, whose log was empty, so the
   previous weights and the history vanished. */
const varOf=(di,si)=>{const v=J(KV+di+':'+si,null);return v&&v.d===dk()?v.v:0};
const setVar=(di,si,v)=>W(KV+di+':'+si,{v,d:dk()});
const baseId=id=>id.split('@')[0];
function variantName(x,v){return v===0?x.n:(x.su&&x.su[v-1])||x.n}
/* An alternate that is also a main lift elsewhere in the week (DB Lateral
   Raise, Leg Extension…) logs under that lift's id, so it has one history. */
const primaryByName=()=>{const m={};PROG.forEach(d=>d.slots.forEach(sl=>sl.ex.forEach(x=>{if(!(x.n in m))m[x.n]=x.id})));return m};
function variantId(x,v){if(v===0)return x.id;const n=variantName(x,v),m=primaryByName();return m[n]||x.id+'@'+v}
const allIds=()=>{const s=new Set();PROG.forEach((d,di)=>d.slots.forEach((sl,si)=>sl.ex.forEach(x=>{
  s.add(x.id); (x.su||[]).forEach((_,i)=>s.add(x.id+'@'+(i+1)))})));return [...s]};
const exName=id=>{const b=baseId(id),v=+(id.split('@')[1]||0);
  for(const d of PROG)for(const sl of d.slots)for(const x of sl.ex)if(x.id===b)return variantName(x,v);return id};
function plannedVol(){const t={};
  PROG.forEach(d=>d.slots.forEach(sl=>sl.ex.forEach(x=>{
    for(const m in MUS[x.id]||{})t[m]=(t[m]||0)+x.s*MUS[x.id][m]})));return t}
function actualVol(n){const cut=new Date(Date.now()-n*864e5).toISOString().slice(0,10),t={};
  allIds().forEach(id=>getEx(id).forEach(e=>{if(e.d>cut){
    const c=e.sets.filter(Boolean).length;
    const b=baseId(id);
    for(const m in MUS[b]||{})t[m]=(t[m]||0)+c*MUS[b][m]}}));return t}
function trainedDays(){const s=new Set();
  allIds().forEach(id=>getEx(id).forEach(e=>{if(e.sets.filter(Boolean).length)s.add(e.d)}));
  return [...s].sort()}
function weekCounts(n){const out=[],days=trainedDays();
  for(let w=n-1;w>=0;w--){
    const hi=new Date(Date.now()-w*7*864e5), lo=new Date(hi-7*864e5);
    out.push(days.filter(d=>{const t=new Date(d+'T12:00:00');return t>lo&&t<=hi}).length)}
  return out}
function logBW(w){const a=J(KBW,[]),d=dk(),i=a.findIndex(x=>x.d===d);
  if(i>=0)a[i].w=+w;else a.push({d,w:+w});a.sort((x,y)=>x.d<y.d?-1:1);W(KBW,a)}
function bwTrend(){const a=J(KBW,[]);if(!a.length)return null;
  const now=Date.now(),age=x=>(now-new Date(x.d+'T12:00:00'))/864e5;
  const R=a.filter(x=>age(x)<7), O=a.filter(x=>age(x)>=14&&age(x)<28);
  const avg=r=>r.reduce((s,x)=>s+x.w,0)/r.length;
  const latest=a[a.length-1];
  if(!R.length||!O.length)return {latest,n:a.length};
  return {latest,n:a.length,cur:avg(R),rate:(avg(R)-avg(O))/17.5*SCALE}}
function stalls(){const out=[];
  allIds().forEach(id=>{const a=getEx(id).filter(e=>e.sets.some(x=>x&&x.r)).slice(-3);   // imported weight-only logs carry no reps
    if(a.length<3)return;
    const best=e=>Math.max(...e.sets.filter(Boolean).map(s=>s.w*s.r));
    if(best(a[2])<=best(a[0]))out.push(id)});
  return out}

/* ═══════════ session state ═══════════ */
let day=0, timer=null, restEnd=0, sessStart=null, tick=null, hideT=null;
const ST=PROG.length, RF=PROG.length+1;   // the stats and reference tabs

function blockWeek(){
  let b=J(KB,null);
  if(!b){b=dk();W(KB,b)}
  const w=Math.floor((new Date(dk())-new Date(b))/864e5/7)+1;
  return ((w-1)%(CFG.block+1))+1;
}
function sessionSets(){
  let done=0,total=0,stamps=[];
  if(!PROG[day])return {done,total,stamps};
  PROG[day].slots.forEach((sl,si)=>sl.ex.forEach(x=>{
    total+=x.s;
    const e=today(variantId(x,varOf(day,si)));
    if(e){done+=e.sets.filter(Boolean).length; e.ts.forEach(t=>t&&stamps.push(t))}
  }));
  return {done,total,stamps:stamps.sort((a,b)=>a-b)};
}
function paint(){
  const {done,total,stamps}=sessionSets();
  document.getElementById('count').textContent=done+'/'+total;
  document.getElementById('progbar').style.width=(total?done/total*100:0)+'%';
  const c=document.getElementById('clock');
  if(stamps.length){
    if(!sessStart)sessStart=stamps[0];
    const m=Math.round((Date.now()-sessStart)/6e4);
    c.textContent=m+' min';
    c.className='pill '+(m>CFG.overMin?'over':'live');
  }else{c.textContent='–';c.className='pill'}
}

/* ═══════════ rest timer ═══════════ */
function startRest(sec,label,next){
  restEnd=Date.now()+sec*1000;
  const el=document.getElementById('rest');
  el.classList.add('show');el.classList.remove('ready');
  document.getElementById('restEx').textContent=label;
  document.getElementById('restNext').textContent=next||'';
  clearInterval(timer);clearTimeout(hideT);
  const total=sec;
  document.getElementById('restN').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
  document.getElementById('restBar').style.width='100%';
  timer=setInterval(()=>{
    const left=Math.max(0,Math.round((restEnd-Date.now())/1000));
    document.getElementById('restN').textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
    document.getElementById('restBar').style.width=(left/total*100)+'%';
    if(left<=0){
      el.classList.add('ready');
      document.getElementById('restEx').textContent='GO — '+label;
      clearInterval(timer);
      if(navigator.vibrate)navigator.vibrate([120,60,120]);
      hideT=setTimeout(()=>el.classList.remove('show'),6000);
    }
  },250);

}
function skipRest(){clearInterval(timer);clearTimeout(hideT);document.getElementById('rest').classList.remove('show')}

/* ═══════════ render ═══════════ */
function render(){
  document.getElementById('wk').textContent='Week '+blockWeek()+(blockWeek()===CFG.block+1?' · DELOAD':'');
  document.getElementById('tabs').innerHTML=
    PROG.map((d,i)=>`<button class="tab${d.dw===new Date().getDay()?' today':''}${i===day?' active':''}" onclick="go(${i})">${d.sh}</button>`).join('')
    +`<button class="tab${day===ST?' active':''}" onclick="go(${ST})">📊</button>`
    +`<button class="tab${day===RF?' active':''}" onclick="go(${RF})">📋</button>`;

  if(day===ST){document.getElementById('cnt').innerHTML=statsHTML();paint();return}
  if(day===RF){
    document.getElementById('cnt').innerHTML='<div class="dv active">'+REFS.map((r,i)=>
      `<div class="ref" onclick="this.classList.toggle('open')"><div class="ref-h"><h3>${r.t}</h3>${CHEV}</div>
       <div class="ref-b">${r.i.map(x=>`<div class="ref-i">${x}</div>`).join('')}</div></div>`).join('')
      +`<button class="btn sec" onclick="exportJSON()">Export all data (JSON)</button>
        <button class="btn sec" onclick="finish()">Session summary</button>
        <button class="btn sec" onclick="newBlock()">Start a new ${CFG.block}-week block</button>`+'</div>';
    paint();return;
  }

  const D=PROG[day];
  let h=`<div class="dv active"><div class="dlb">${D.lb}</div>`, n=0;
  D.slots.forEach((sl,si)=>{
    const isMyo=!!sl.ex[0].myo;
    h+=`<div class="slot${isMyo?' myo':''}">`;
    if(isMyo)h+=`<div class="ss-hd">◈ Myo-reps — one station<span class="rt">15s between minis</span></div>`;
    sl.ex.forEach((x,xi)=>{
      n++;
      const v=varOf(day,si), xid=variantId(x,v), xn=variantName(x,v);
      const p=prev(xid), t=today(xid);
      const doneN=t?t.sets.filter(Boolean).length:0;
      const lbl=String(n);
      let prevH='';
      if(p)prevH=`<div class="ex-prev${earned({...x,id:xid})?' up':''}">${fmtSets(p)}${earned({...x,id:xid})?' ▲':''}</div>`;
      let rows=`<div class="shdr"><span></span><span>Weight</span><span>Reps</span><span></span></div>`;
      for(let i=0;i<x.s;i++){
        const st=t&&t.sets[i], ps=p&&p.sets[i];
        const mini=x.myo&&i>0;
        rows+=`<div class="srow${st?' done':''}${mini?' mini':''}" id="r-${si}-${xi}-${i}">
          <div class="sn">${mini?'+':i+1}</div>
          <div class="fld"><input type="number" inputmode="decimal" step="0.5" placeholder="${ps?n1(ps.w):''}" value="${st?n1(st.w):''}" id="w-${si}-${xi}-${i}"><span class="u">kg</span></div>
          <div class="fld"><input type="number" inputmode="numeric" placeholder="${ps&&ps.r?ps.r:(mini?'5':x.r.split(/[–-]/)[0])}" value="${st?st.r:''}" id="p-${si}-${xi}-${i}"></div>
          <button class="tick" onclick="mark(${si},${xi},${i})">${TICK}</button></div>`;
      }
      h+=`<div class="ex" id="ex-${si}-${xi}">
        <div class="ex-hd" onclick="this.parentNode.classList.toggle('open')">
          <div class="ex-badge${doneN>=x.s?' done':''}">${lbl}</div>
          <div class="ex-main"><div class="ex-n">${xn}</div>
            <div class="ex-sub"><b>${x.myo?'1 × '+x.r+' then 3 × 5':x.s+' × '+x.r}</b> · <span class="tgt">${x.tg}</span></div></div>
          ${prevH}${CHEV}</div>
        <div class="sets">${rows}</div>
        <div class="det"><div class="nt">${x.nt}</div>
          <div class="swap"><span class="swap-l">Station taken?</span>
            ${[x.n,...(x.su||[])].map((alt,vi)=>`<button class="sw${vi===v?' on':''}" onclick="event.stopPropagation();swapTo(${si},${xi},${vi})">${alt}</button>`).join('')}</div>
          <div class="hist" id="h-${si}-${xi}">${histHTML(xid)}</div></div></div>`;
    });
    h+=`</div>`;
  });
  document.getElementById('cnt').innerHTML=h+'</div>';
  paint();
}
function statsHTML(){
  const plan=plannedVol(), act=actualVol(7);
  const order=Object.keys(plan).sort((a,b)=>plan[b]-plan[a]);
  const pct=v=>Math.min(100,v/SCALE*100);
  // only judge the week once most of it has happened — otherwise every
  // Tuesday reads as "under-trained" simply because Sunday hasn't come round
  const logged=weekCounts(1)[0], full=logged>=PROG.length-1;
  const rows=order.map(m=>{
    const p=plan[m], a=act[m]||0;
    const cls = !full ? '' : a<CFG.band[0]&&p>=CFG.band[0] ? 'low' : a>CFG.band[1] ? 'high' : '';
    return `<div class="vr"><span class="vm">${m}</span>
      <span class="vtr"><span class="band" style="left:${CFG.band[0]/SCALE*100}%;width:${(CFG.band[1]-CFG.band[0])/SCALE*100}%"></span>
        <span class="fill ${cls}" style="width:${pct(a)}%"></span>
        <span class="plan" style="left:${pct(p)}%"></span></span>
      <span class="vn ${cls}">${a%1?a.toFixed(1):a}<span style="color:var(--t4);font-weight:500">/${p%1?p.toFixed(1):p}</span></span></div>`;
  }).join('');

  const wc=weekCounts(4), tgt=PROG.length;
  const weeks=wc.map((n,i)=>`<div class="${n>=tgt?'good':n>0?'miss':''}">
    <div class="n">${n}</div><div class="l">${i===3?'this wk':(4-i-1)+'w ago'}</div></div>`).join('');

  const bw=bwTrend();
  let bwBody=`<div class="bwrow"><input id="bwIn" type="number" step="0.1" inputmode="decimal"
      placeholder="${bw?bw.latest.w:'kg'}"><button onclick="saveBW()">Log today</button></div>`;
  if(!bw) bwBody+=`<div class="note">Nothing logged yet. Weigh daily, first thing — the daily number is noise, the weekly average is the signal.</div>`;
  else if(bw.rate===undefined) bwBody+=`<div class="big">${n1(bw.latest.w)} kg</div>
      <div class="note">${bw.n} entr${bw.n>1?'ies':'y'} so far. Needs about three weeks before a trend means anything.</div>`;
  else {
    const r=bw.rate, ok=r>=CFG.bw.lo&&r<=CFG.bw.hi;
    bwBody+=`<div class="big">${n1(bw.cur)} kg <span style="font-size:13px;font-weight:600;color:var(--t3)">7-day avg</span></div>
     <div class="note ${ok?'ok':'warn'}">Trending <b>${r>0?'+':''}${n1(r)} kg / month</b>.
     ${CFG.bw.msg(r,ok)}</div>`;
  }

  const st=stalls();
  const stallBody = st.length
    ? st.map(id=>`<div class="stall">${exName(id)} — <b>no gain in 3 sessions</b></div>`).join('')
      +`<div class="note">Stalling on one or two lifts is normal. Half the list stalling at once means the block is done — deload, then start a new one.</div>`
    : `<div class="note ok">Nothing stalled. Every lift with three logged sessions has moved.</div>`;

  return `<div class="dv active">
   <div class="card"><h4>Weekly volume by muscle</h4>
     <div class="cap">Filled bar = sets you actually logged in the last 7 days. The line is what the programme prescribes; ${CFG.bandNote}${full?'':' <b>'+logged+' of '+PROG.length+' sessions in so far</b> — colours hold off until the week is nearly done.'}</div>
     ${rows}</div>
   <div class="card"><h4>Consistency</h4>
     <div class="cap">Sessions per week. Early training frequency is the single strongest predictor of whether people stick with lifting at all — it matters more than what any one session contained.</div>
     <div class="wk">${weeks}</div></div>
   <div class="card"><h4>Bodyweight</h4>
     <div class="cap">${CFG.bw.cap}</div>
     ${bwBody}</div>
   <div class="card"><h4>Progression check</h4>
     <div class="cap">Best set (weight × reps) versus three sessions ago.</div>
     ${stallBody}</div></div>`;
}
function saveBW(){const i=document.getElementById('bwIn'),v=i.value.trim();
  if(!v){toast('Enter a weight');return}
  logBW(v);render();toast('Logged '+n1(+v)+' kg')}

function histHTML(id){
  const a=logsFor(id).filter(e=>e.sets.filter(Boolean).length).slice(-6).reverse();
  if(!a.length)return '';
  return `<div class="hist-t">Last ${a.length} session${a.length>1?'s':''}</div>`+
    a.map(e=>`<div class="hrow"><span class="hd8">${fmtD(e.d)}</span><span class="hv">${fmtSets(e)}</span></div>`).join('');
}

/* ═══════════ actions ═══════════ */
function swapTo(si,xi,v){setVar(day,si,v);render();toast(v?'Swapped in':'Back to the main lift')}
function mark(si,xi,i){
  const sl=PROG[day].slots[si], x=sl.ex[xi];
  const v=varOf(day,si), xid=variantId(x,v), xn=variantName(x,v);
  const wi=document.getElementById(`w-${si}-${xi}-${i}`), pi=document.getElementById(`p-${si}-${xi}-${i}`);
  const row=document.getElementById(`r-${si}-${xi}-${i}`);
  if(row.classList.contains('done')){
    unlogSet(xid,i);row.classList.remove('done');paint();refreshHist(si,xi);return;
  }
  const w=wi.value.trim()||wi.placeholder||(x.bw?'0':''), r=pi.value.trim()||pi.placeholder;
  if(!w||!r){toast('Weight and reps first');wi.focus();return}
  wi.value=w;pi.value=r;
  logSet(xid,i,w,r);
  row.classList.add('done');
  const badge=document.querySelector(`#ex-${si}-${xi} .ex-badge`);
  const t=today(xid);
  if(t&&t.sets.filter(Boolean).length>=x.s)badge.classList.add('done');
  refreshHist(si,xi);paint();
  // superset: point at the partner; otherwise the same exercise
  if(i+1<x.s) startRest(sl.rest, xn, x.myo?`then ${i?'another':'the first'} mini-set of 5`:`set ${i+2} of ${x.s}`);
  else{const nx=PROG[day].slots[si+1];   // rest into the next exercise, not nothing
    if(nx)startRest(Math.max(sl.rest,90),'Next exercise',variantName(nx.ex[0],varOf(day,si+1)));
    else skipRest()}
  if(sessionSets().done===sessionSets().total)setTimeout(finish,900);
}
function refreshHist(si,xi){
  const el=document.getElementById(`h-${si}-${xi}`);
  const x=PROG[day].slots[si].ex[xi];
  if(el)el.innerHTML=histHTML(variantId(x,varOf(day,si)));
}
function go(i){day=i;render();window.scrollTo({top:0,behavior:'smooth'})}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1600)}

/* ═══════════ session summary ═══════════ */
function finish(){
  skipRest();
  if(!PROG[day]){toast('Open a training day first');return}
  const {done,total,stamps}=sessionSets();
  if(!stamps.length){toast('Nothing logged today');return}
  const mins=Math.max(1,Math.round((stamps[stamps.length-1]-stamps[0])/6e4));
  const gaps=[];for(let i=1;i<stamps.length;i++){const g=(stamps[i]-stamps[i-1])/1000;if(g<600)gaps.push(g)}
  const avg=gaps.length?Math.round(gaps.reduce((a,b)=>a+b)/gaps.length):0;
  let tgt=0,tn=0;
  PROG[day].slots.forEach(sl=>sl.ex.forEach(x=>{tgt+=sl.rest*x.s;tn+=x.s}));
  const tgtAvg=Math.round(tgt/tn)+40;         // prescribed gap + ~40 s for the set itself
  const over=avg-tgtAvg, lost=Math.round(over*gaps.length/60);
  const w=x=>Math.floor(x/60)+':'+String(x%60).padStart(2,'0');
  document.getElementById('sheetIn').innerHTML=`
   <h3>${PROG[day].lb}</h3><div class="sub">${done} of ${total} sets logged</div>
   <div class="stat-g">
     <div class="stat"><div class="k">Session</div><div class="v">${mins} min</div><div class="n">first set to last</div></div>
     <div class="stat"><div class="k">Sets done</div><div class="v">${done}/${total}</div><div class="n">${Math.round(done/total*100)}% of the plan</div></div>
     <div class="stat"><div class="k">Avg per set</div><div class="v">${w(avg)}</div><div class="n">work + rest</div></div>
     <div class="stat"><div class="k">Target</div><div class="v">${w(tgtAvg)}</div><div class="n">prescribed pace</div></div>
   </div>
   ${over>25
     ? `<div class="verdict warn">You're running <b>${w(over)} slower per set</b> than prescribed — about <b>${lost} minutes</b> added to this session. That's rest drift, not the program. Let the timer run the rests and this session becomes ~${Math.max(30,mins-lost)} min.</div>`
     : over<-20
     ? `<div class="verdict">You're resting <b>${w(-over)} less per set</b> than prescribed. Under 60 s between sets costs a little growth — let the timer finish.</div>`
     : `<div class="verdict">Pace is on target. This session's length is the <b>programme</b>, not your rests — if it's still too long, that's a volume decision, not a timing one.</div>`}
   <button class="btn" onclick="document.getElementById('sheet').classList.remove('show')">Done</button>`;
  document.getElementById('sheet').classList.add('show');
}
function exportJSON(){
  const out={exported:new Date().toISOString(),blockStart:J(KB,null),bodyweight:J(KBW,[]),log:{}};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
    if(k.startsWith(K)&&k!==KB&&k!==KBW)out.log[k.slice(K.length)]=J(k,[])}
  const s=JSON.stringify(out,null,1);
  navigator.clipboard?.writeText(s).then(()=>toast('Copied to clipboard'),()=>{});
  const win=window.open('','_blank');
  if(win){win.document.write('<pre style="font:12px/1.4 monospace;white-space:pre-wrap;word-break:break-all">'+
    s.replace(/[<&]/g,c=>({'<':'&lt;','&':'&amp;'}[c]))+'</pre>');win.document.close()}
  else toast('Copied — paste somewhere safe');
}
function newBlock(){
  if(!confirm('Start a new '+CFG.block+'-week block from today? Your logged weights are kept.'))return;
  W(KB,dk());render();toast('Week 1');
}

/* ═══════════ boot ═══════════ */
if(CFG.migrate)CFG.migrate();
day=Math.max(0,PROG.findIndex(d=>d.dw===new Date().getDay()));
render();
setInterval(paint,30000);
document.getElementById('sheet').addEventListener('click',e=>{
  if(e.target.id==='sheet')e.currentTarget.classList.remove('show')});
