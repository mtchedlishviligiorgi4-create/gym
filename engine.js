const CHEV='<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>';
const TICK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg>';
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ═══════════ storage ═══════════
   Every exercise log is K+id → [{d:'YYYY-MM-DD', pd:'Fri', sets:[{w,r}|null], ts:[ms]}].
   pd = the programme day the sets were logged under, so Friday's leg curl
   never shows Wednesday's numbers. A removed set is null with a fresh ts
   (a tombstone), so sync can't bring it back. */
const K=CFG.key, KB=K+'blockStart', KBW=K+'bw', KV=K+'var:', KD=K+'draft', KSK=K+'synckey', KSY=K+'synced';
const pad=n=>String(n).padStart(2,'0');
const dk=d=>{d=d||new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};  // LOCAL date
const D=s=>new Date(s+'T12:00:00');
const J=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch(e){return f}};
let _memo=null;
const W=(k,v)=>{_memo=null;try{localStorage.setItem(k,JSON.stringify(v))}catch(e){toast('Storage full')}};
const META=new Set(['blockStart','bw','draft','synckey','synced','sessions','migrated']);
/* every exercise ever logged, including ones a newer programme dropped */
function logKeys(){
  if(_memo)return _memo;
  const out=[];
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
    if(!k||!k.startsWith(K))continue;const id=k.slice(K.length);
    if(META.has(id)||id.startsWith('var:'))continue;
    const v=J(k,null);if(Array.isArray(v)&&(!v.length||v[0]&&v[0].sets))out.push(id)}
  return _memo=out;
}

const getEx=id=>J(K+id,[]);
const live=e=>e&&e.sets?e.sets.filter(Boolean):[];
function logSet(id,i,w,r){
  const a=getEx(id), d=dk();
  let e=a.find(x=>x.d===d);
  if(!e){e={d,pd:PROG[day].sh,sets:[],ts:[]};a.push(e);a.sort((x,y)=>x.d<y.d?-1:1)}
  if(!e.pd)e.pd=PROG[day].sh;
  e.sets[i]={w:+w||0,r:+r||0};
  e.ts[i]=Date.now();
  W(K+id,a);queueSync();
}
function unlogSet(id,i){
  const a=getEx(id), e=a.find(x=>x.d===dk());
  if(!e)return;
  e.sets[i]=null; e.ts[i]=Date.now();
  W(K+id,a);queueSync();
}
const today=id=>getEx(id).find(x=>x.d===dk());

/* which programme day an entry belongs to: its tag, else the only day that
   has the exercise, else the weekday it was logged on */
/* Old logs have no tag. For each date, the programme day whose exercise list
   best matches what was logged that date — so a Tuesday session done on a
   Monday still counts as Tuesday. */
let _dmap=null;
function dateDays(){
  if(_dmap&&_dmap.memo===_memo&&_memo)return _dmap.m;
  const byDate={};logKeys().forEach(id=>getEx(id).forEach(e=>{if(live(e).length)(byDate[e.d]=byDate[e.d]||new Set()).add(baseId(id))}));
  const m={};
  for(const d in byDate){let best=null,bs=0,tie=false;
    PROG.forEach(P=>{const ids=new Set(P.slots.flatMap(sl=>sl.ex.map(x=>x.id)));
      let sc=0;byDate[d].forEach(i=>ids.has(i)&&sc++);
      if(sc>bs){bs=sc;best=P;tie=false}else if(sc===bs&&sc>0){tie=true;if(P.dw===D(d).getDay())best=P}});
    if(best&&(!tie||best.dw===D(d).getDay()))m[d]=best}
  _dmap={memo:logKeys(),m};return m}
function dayOf(id,e){
  if(e.pd)return e.pd;
  const b=baseId(id), has=PROG.filter(d=>d.slots.some(sl=>sl.ex.some(x=>x.id===b)));
  const g=dateDays()[e.d];
  if(g&&has.includes(g))return g.sh;
  if(has.length===1)return has[0].sh;
  const wd=PROG.find(d=>d.dw===D(e.d).getDay());
  return wd?wd.sh:null;
}
/* every log of this exercise, whatever id it was saved under */
function logsFor(id){const n=exName(id),out=[];
  logKeys().forEach(k=>{if(k===id||exName(k)===n)getEx(k).forEach(e=>out.push({...e,_id:k}))});
  return out.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0)}
/* last time on THIS programme day; falls back to any day, flagged */
function prev(id,sh){
  const a=logsFor(id).filter(e=>e.d!==dk()&&live(e).length);
  for(let i=a.length-1;i>=0;i--)if(dayOf(a[i]._id,a[i])===sh)return {...a[i],same:true};
  return a.length?{...a[a.length-1],same:false}:null;
}
const n1=v=>Math.round(v*10)/10;
function fmtSets(e){
  const s=live(e);
  if(!s.length)return '—';
  const w=[...new Set(s.map(x=>x.w))], r=s.map(x=>x.r);
  const ws=w.length===1?n1(w[0]):n1(Math.min(...w))+'–'+n1(Math.max(...w));
  if(r.every(x=>!x))return ws+' kg';                       // imported weight-only log
  return (w.length===1&&w[0]===0?'BW':ws+' kg')+' × '+r.join('/');
}
function fmtD(d){const t=D(d);return WD[t.getDay()]+' '+t.getDate()+' '+MON[t.getMonth()]}
/* earned the increment? every set on this day's last session at or above the top of the range */
function earned(ex,sh){
  const p=prev(ex.id,sh); if(!p||!p.same)return false;
  const s=live(p);
  if(s.length<ex.s)return false;
  const top=+ex.r.split(/[–-]/)[1];
  return s.every(x=>x.r>=top);
}

/* ═══════════ weeks ═══════════
   Week 1 is the calendar week (Mon–Sun) of the first set you ever logged.
   It never resets — week 1, 2, 3 … forever, so history lines up. */
const monday=d=>{const t=D(d),g=(t.getDay()+6)%7;t.setDate(t.getDate()-g);return dk(t)};
function firstDay(){let m=null;
  logKeys().forEach(id=>getEx(id).forEach(e=>{if(live(e).length&&(!m||e.d<m))m=e.d}));
  return m||J(KB,null)||dk()}
const weekNo=d=>Math.round((D(monday(d))-D(monday(firstDay())))/(7*864e5))+1;
const isDeload=w=>w%(CFG.block+1)===0;

const KBWR=K+'bwr', SCALE=30;
/* A swap is for today only: the station was taken TODAY. */
const varOf=(di,si)=>{const v=J(KV+di+':'+si,null);return v&&v.d===dk()?v.v:0};
const setVar=(di,si,v)=>W(KV+di+':'+si,{v,d:dk()});
const baseId=id=>id.split('@')[0];
function variantName(x,v){return v===0?x.n:(x.su&&x.su[v-1])||x.n}
const primaryByName=()=>{const m={};PROG.forEach(d=>d.slots.forEach(sl=>sl.ex.forEach(x=>{if(!(x.n in m))m[x.n]=x.id})));return m};
function variantId(x,v){if(v===0)return x.id;const n=variantName(x,v),m=primaryByName();return m[n]||x.id+'@'+v}
const allIds=()=>{const s=new Set(logKeys());PROG.forEach(d=>d.slots.forEach(sl=>sl.ex.forEach(x=>{
  s.add(x.id); (x.su||[]).forEach((_,i)=>s.add(x.id+'@'+(i+1)))})));return [...s]};
const exName=id=>{const b=baseId(id),v=+(id.split('@')[1]||0);
  for(const d of PROG)for(const sl of d.slots)for(const x of sl.ex)if(x.id===b)return variantName(x,v);
  return (CFG.oldNames&&CFG.oldNames[id])||b.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase())};
function plannedVol(){const t={};
  PROG.forEach(d=>d.slots.forEach(sl=>sl.ex.forEach(x=>{
    for(const m in MUS[x.id]||{})t[m]=(t[m]||0)+x.s*MUS[x.id][m]})));return t}
function actualVol(n){const cut=dk(new Date(Date.now()-n*864e5)),t={};
  allIds().forEach(id=>getEx(id).forEach(e=>{if(e.d>cut){
    const c=live(e).length, b=baseId(id);
    for(const m in MUS[b]||{})t[m]=(t[m]||0)+c*MUS[b][m]}}));return t}
function trainedDays(){const s=new Set();
  logKeys().forEach(id=>getEx(id).forEach(e=>{if(live(e).length)s.add(e.d)}));
  return [...s].sort()}
function weekCounts(n){const out=[],days=trainedDays(),cur=weekNo(dk());
  for(let w=cur-n+1;w<=cur;w++)out.push({w,n:days.filter(d=>weekNo(d)===w).length});
  return out}

/* ═══════════ bodyweight ═══════════ */
const bwAll=()=>J(KBW,[]).filter(x=>x&&x.w!=null&&x.w>0).sort((a,b)=>a.d<b.d?-1:1);
function logBW(w,d){d=d||dk();const a=J(KBW,[]),i=a.findIndex(x=>x.d===d),e={d,w:+w,t:Date.now()};
  if(i>=0)a[i]=e;else a.push(e);a.sort((x,y)=>x.d<y.d?-1:1);W(KBW,a);queueSync()}
function delBW(d){const a=J(KBW,[]),i=a.findIndex(x=>x.d===d);if(i<0)return;
  a[i]={d,w:null,t:Date.now()};W(KBW,a);queueSync();render();toast('Removed '+fmtD(d))}
/* 7-day trailing mean for each weigh-in */
function bwAvg(a){return a.map(x=>{const lo=dk(new Date(D(x.d)-6*864e5));
  const r=a.filter(y=>y.d>=lo&&y.d<=x.d);return r.reduce((s,y)=>s+y.w,0)/r.length})}
function bwTrend(){const a=bwAll();if(!a.length)return null;
  const now=D(dk()),age=x=>(now-D(x.d))/864e5;
  const R=a.filter(x=>age(x)<7), O=a.filter(x=>age(x)>=21&&age(x)<35);
  const avg=r=>r.reduce((s,x)=>s+x.w,0)/r.length;
  const latest=a[a.length-1];
  if(!R.length||!O.length)return {latest,n:a.length,cur:R.length?avg(R):null};
  return {latest,n:a.length,cur:avg(R),rate:(avg(R)-avg(O))/28*(CFG.bw.per||30)}}
function stalls(){const out=[];
  logKeys().forEach(id=>{const g={};
    getEx(id).filter(e=>live(e).some(x=>x.r)).forEach(e=>{const s=dayOf(id,e)||'?';(g[s]=g[s]||[]).push(e)});
    for(const sh in g){const a=g[sh].slice(-3);if(a.length<3)continue;
      const best=e=>Math.max(...live(e).map(s=>s.w*s.r));
      if(best(a[2])<=best(a[0]))out.push(exName(id)+' ('+sh+')')}});
  return out}

/* ═══════════ drafts: typed but not ticked survives a re-render ═══════════ */
function drafts(){const o=J(KD,null);return o&&o.d===dk()?o.v:{}}
function draft(el){const v=drafts();v[day+':'+el.id]=el.value;W(KD,{d:dk(),v})}
function clearDraft(ids){const v=drafts();ids.forEach(i=>delete v[day+':'+i]);W(KD,{d:dk(),v})}

/* ═══════════ cloud sync ═══════════
   Same merge rules as the worker (gym-sync/merge.js): union, newer ts wins. */
const SYNC_URL='https://gym-sync.mzeqalashvilizaza.workers.dev/sync';
function mergeEntries(a,b){const m={};
  for(const e of [...(a||[]),...(b||[])]){if(!e||!e.d)continue;const o=m[e.d];
    if(!o){m[e.d]={d:e.d,pd:e.pd,sets:[...(e.sets||[])],ts:[...(e.ts||[])]};continue}
    if(!o.pd&&e.pd)o.pd=e.pd;
    const n=Math.max(o.sets.length,(e.sets||[]).length);
    for(let i=0;i<n;i++){const to=o.ts[i]||0,te=(e.ts||[])[i]||0,se=(e.sets||[])[i];
      if(te>to||(te===to&&!o.sets[i]&&se)){o.sets[i]=se==null?null:se;o.ts[i]=te}}}
  if(!m[undefined])delete m[undefined];
  return Object.values(m).sort((x,y)=>x.d<y.d?-1:1)}
function buildDoc(){const logs={};logKeys().forEach(id=>logs[id]=getEx(id));return {logs,bw:J(KBW,[])}}
function applyDoc(doc){let changed=false;
  for(const id in doc.logs||{}){const cur=getEx(id),m=mergeEntries(cur,doc.logs[id]);
    if(JSON.stringify(m)!==JSON.stringify(cur)){W(K+id,m);changed=true}}
  const cb=J(KBW,[]),bm={};
  for(const x of [...cb,...(doc.bw||[])]){if(!x||!x.d)continue;const o=bm[x.d];
    if(!o||(x.t||0)>(o.t||0)||((x.t||0)===(o.t||0)&&o.w==null&&x.w!=null))bm[x.d]=x}
  const nb=Object.values(bm).sort((x,y)=>x.d<y.d?-1:1);
  if(JSON.stringify(nb)!==JSON.stringify(cb)){W(KBW,nb);changed=true}
  return changed}
let syncT=null, syncBusy=false, syncAgain=false, syncState='off';
function syncKey(){
  const q=new URLSearchParams(location.search).get('k')||new URLSearchParams(location.hash.slice(1)).get('k');
  if(q&&/^[A-Za-z0-9_-]{16,64}$/.test(q)&&q!==localStorage.getItem(KSK))localStorage.setItem(KSK,q);
  return localStorage.getItem(KSK)||CFG.sync||null}
function queueSync(){if(!syncKey())return;setSync('pending');clearTimeout(syncT);syncT=setTimeout(sync,1200)}
async function sync(){
  const key=syncKey(); if(!key){setSync('off');return}
  if(syncBusy){syncAgain=true;return}
  syncBusy=true;
  try{
    const r=await fetch(SYNC_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Key':key},body:JSON.stringify(buildDoc())});
    if(!r.ok)throw new Error(r.status);
    const changed=applyDoc(await r.json());
    localStorage.setItem(KSY,String(Date.now()));setSync('ok');
    if(changed){const a=document.activeElement;
      if(!a||a.tagName!=='INPUT')render();else a.addEventListener('blur',()=>render(),{once:true})}
  }catch(e){setSync('err')}
  syncBusy=false;
  if(syncAgain){syncAgain=false;sync()}
}
function setSync(s){syncState=s;let p=document.getElementById('sync');
  if(!p){p=document.createElement('div');p.id='sync';document.querySelector('.hd-meta').prepend(p)}
  p.className='pill sync '+s;
  p.textContent={ok:'☁︎ saved',pending:'☁︎ …',err:'☁︎ offline',off:'☁︎ off'}[s];
  p.onclick=()=>go(ST)}
function setKey(){const v=document.getElementById('skIn').value.trim();
  if(!/^[A-Za-z0-9_-]{16,64}$/.test(v)){toast('That code looks wrong');return}
  localStorage.setItem(KSK,v);toast('Sync on');sync();render()}

/* ═══════════ session state ═══════════ */
let day=0, timer=null, restEnd=0, sessStart=null, hideT=null, bwRange=J(KBWR,'3m'), histWeek=null;
const ST=PROG.length, RF=PROG.length+1, BW=PROG.length+2, HI=PROG.length+3;   // extra tabs

function sessionSets(){
  let done=0,total=0,stamps=[];
  if(!PROG[day])return {done,total,stamps};
  PROG[day].slots.forEach((sl,si)=>sl.ex.forEach(x=>{
    total+=x.s;
    const e=today(variantId(x,varOf(day,si)));
    if(e){e.sets.forEach((s,i)=>{if(s){done++;e.ts[i]&&stamps.push(e.ts[i])}})}
  }));
  return {done,total,stamps:stamps.sort((a,b)=>a-b)};
}
function paint(){
  const {done,total,stamps}=sessionSets();
  document.getElementById('count').textContent=done+'/'+total;
  document.getElementById('progbar').style.width=(total?done/total*100:0)+'%';
  const c=document.getElementById('clock');
  if(stamps.length){
    sessStart=stamps[0];
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
  document.getElementById('restN').textContent=Math.floor(sec/60)+':'+pad(sec%60);
  document.getElementById('restBar').style.width='100%';
  timer=setInterval(()=>{
    const left=Math.max(0,Math.round((restEnd-Date.now())/1000));
    document.getElementById('restN').textContent=Math.floor(left/60)+':'+pad(left%60);
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
  const wk=weekNo(dk());
  document.getElementById('wk').textContent='Week '+wk+(isDeload(wk)?' · DELOAD':'');
  const tab=(i,l)=>`<button class="tab${day===i?' active':''}" onclick="go(${i})">${l}</button>`;
  document.getElementById('tabs').innerHTML=
    PROG.map((d,i)=>`<button class="tab${d.dw===new Date().getDay()?' today':''}${i===day?' active':''}" onclick="go(${i})">${d.sh}</button>`).join('')
    +tab(BW,'Weight')+tab(HI,'History')+tab(ST,'📊')+tab(RF,'📋');
  const cnt=document.getElementById('cnt');
  if(day===ST){cnt.innerHTML=statsHTML();paint();return}
  if(day===BW){cnt.innerHTML=bwHTML();drawBW();paint();return}
  if(day===HI){cnt.innerHTML=historyHTML();paint();return}
  if(day===RF){
    cnt.innerHTML='<div class="dv active">'+REFS.map(r=>
      `<div class="ref" onclick="this.classList.toggle('open')"><div class="ref-h"><h3>${r.t}</h3>${CHEV}</div>
       <div class="ref-b">${r.i.map(x=>`<div class="ref-i">${x}</div>`).join('')}</div></div>`).join('')
      +`<button class="btn sec" onclick="exportJSON()">Export all data (JSON)</button>
        <button class="btn sec" onclick="finish()">Session summary</button>`+'</div>';
    paint();return;
  }

  const P=PROG[day], dr=drafts();
  let h=`<div class="dv active">${installHTML()}<div class="dlb">${P.lb}${isDeload(wk)?' · deload: same weights, half the sets':''}</div>`, n=0;
  P.slots.forEach((sl,si)=>{
    const isMyo=!!sl.ex[0].myo;
    h+=`<div class="slot${isMyo?' myo':''}">`;
    if(isMyo)h+=`<div class="ss-hd">◈ Myo-reps — one station<span class="rt">15s between minis</span></div>`;
    sl.ex.forEach((x,xi)=>{
      n++;
      const v=varOf(day,si), xid=variantId(x,v), xn=variantName(x,v);
      const p=prev(xid,P.sh), t=today(xid);
      const doneN=t?live(t).length:0, up=earned({...x,id:xid},P.sh);
      let prevH='';
      if(p)prevH=`<div class="ex-prev${up?' up':''}${p.same?'':' other'}"><span class="pl">${p.same?'W'+weekNo(p.d)+' '+P.sh:'last: '+(dayOf(p._id,p)||fmtD(p.d))}</span>${fmtSets(p)}${up?' ▲':''}</div>`;
      const ps=p&&p.same?p:null;
      let rows=`<div class="shdr"><span></span><span>Weight</span><span>Reps</span><span></span></div>`;
      for(let i=0;i<x.s;i++){
        const st=t&&t.sets[i], pv=(ps&&ps.sets[i])||(p&&live(p)[Math.min(i,live(p).length-1)]);
        const mini=x.myo&&i>0, wid=`w-${si}-${xi}-${i}`, rid=`p-${si}-${xi}-${i}`;
        rows+=`<div class="srow${st?' done':''}${mini?' mini':''}" id="r-${si}-${xi}-${i}">
          <div class="sn">${mini?'+':i+1}</div>
          <div class="fld"><input type="number" inputmode="decimal" step="0.5" placeholder="${pv?n1(pv.w):''}" value="${st?n1(st.w):(dr[day+':'+wid]||'')}" id="${wid}" oninput="draft(this)"><span class="u">kg</span></div>
          <div class="fld"><input type="number" inputmode="numeric" placeholder="${ps&&ps.sets[i]&&ps.sets[i].r?ps.sets[i].r:(mini?'5':x.r.split(/[–-]/)[0])}" value="${st?st.r:(dr[day+':'+rid]||'')}" id="${rid}" oninput="draft(this)"></div>
          <button class="tick" onclick="mark(${si},${xi},${i})">${TICK}</button></div>`;
      }
      h+=`<div class="ex" id="ex-${si}-${xi}">
        <div class="ex-hd" onclick="this.parentNode.classList.toggle('open')">
          <div class="ex-badge${doneN>=x.s?' done':''}">${n}</div>
          <div class="ex-main"><div class="ex-n">${xn}</div>
            <div class="ex-sub"><b>${x.myo?'1 × '+x.r+' then '+(x.s-1)+' × 5':x.s+' × '+x.r}</b> · <span class="tgt">${x.tg}</span>${CFG.rir?`<span class="rir">${x.c?'1–2 RIR':'last set to failure'}</span>`:''}</div></div>
          ${prevH}${CHEV}</div>
        <div class="sets">${rows}</div>
        <div class="det"><div class="nt">${x.nt}</div>
          <div class="swap"><span class="swap-l">Station taken?</span>
            ${[x.n,...(x.su||[])].map((alt,vi)=>`<button class="sw${vi===v?' on':''}" onclick="event.stopPropagation();swapTo(${si},${xi},${vi})">${alt}</button>`).join('')}</div>
          <div class="hist" id="h-${si}-${xi}">${histHTML(xid,P.sh)}</div></div></div>`;
    });
    h+=`</div>`;
  });
  cnt.innerHTML=h+'</div>';
  paint();
}

/* card history: this day's sessions by week, then the other days */
function histHTML(id,sh){
  const a=logsFor(id).filter(e=>live(e).length).reverse();
  if(!a.length)return '';
  const same=a.filter(e=>dayOf(e._id,e)===sh), other=a.filter(e=>dayOf(e._id,e)!==sh);
  const row=(e,lbl)=>`<div class="hrow"><span class="hd8"><b>${lbl}</b> ${fmtD(e.d)}</span><span class="hv">${fmtSets(e)}</span></div>`;
  let h='';
  if(same.length)h+=`<div class="hist-t">${sh} sessions</div>`+same.slice(0,8).map(e=>row(e,'W'+weekNo(e.d))).join('');
  if(other.length)h+=`<div class="hist-t">Other days</div>`+other.slice(0,3).map(e=>row(e,dayOf(e._id,e)||'')).join('');
  return h;
}

/* ═══════════ history tab: week by week ═══════════ */
function historyHTML(){
  const cur=weekNo(dk()), byWeek={};
  logKeys().forEach(id=>getEx(id).forEach(e=>{if(!live(e).length)return;
    const w=weekNo(e.d);(byWeek[w]=byWeek[w]||[]).push({id,e})}));
  if(histWeek==null||histWeek>cur)histWeek=cur;
  let chips='';for(let w=cur;w>=1;w--)chips+=`<button class="chip${w===histWeek?' on':''}${byWeek[w]?'':' empty'}" onclick="histWeek=${w};render()">W${w}${isDeload(w)?'·D':''}</button>`;
  const items=byWeek[histWeek]||[], byDay={};
  items.forEach(o=>{const s=dayOf(o.id,o.e)||'Other';(byDay[s]=byDay[s]||[]).push(o)});
  const mon=D(monday(firstDay()));mon.setDate(mon.getDate()+(histWeek-1)*7);
  const sun=new Date(mon);sun.setDate(sun.getDate()+6);
  const order=[...PROG.map(p=>p.sh),...Object.keys(byDay).filter(s=>!PROG.some(p=>p.sh===s))];
  let body=order.filter(s=>byDay[s]).map(s=>{
    const L=byDay[s], dates=[...new Set(L.map(o=>o.e.d))].sort();
    const P=PROG.find(p=>p.sh===s), ord=id=>{if(!P)return 99;let k=0;
      for(const sl of P.slots)for(const x of sl.ex){if(x.id===baseId(id))return k;k++}return 99};
    L.sort((a,b)=>ord(a.id)-ord(b.id));
    const sets=L.reduce((n,o)=>n+live(o.e).length,0);
    return `<div class="card hday"><div class="hday-h"><h4>${s}${P?' · '+P.lb:''}</h4><span>${dates.map(fmtD).join(', ')} · ${sets} sets</span></div>
      ${L.map(o=>`<div class="hrow"><span class="hd8">${exName(o.id)}</span><span class="hv">${fmtSets(o.e)}</span></div>`).join('')}</div>`}).join('');
  if(!body)body=`<div class="card"><div class="note">Nothing logged in week ${histWeek}.</div></div>`;
  return `<div class="dv active"><div class="chips">${chips}</div>
    <div class="dlb">Week ${histWeek} · ${fmtD(dk(mon))} – ${fmtD(dk(sun))}${isDeload(histWeek)?' · deload':''}</div>${body}</div>`;
}

/* ═══════════ weight tab ═══════════ */
function bwHTML(){
  const a=bwAll(), tr=bwTrend();
  let tiles='';
  if(a.length){
    const av=bwAvg(a), last=av[av.length-1];
    const ago=a.findIndex(x=>x.d>=dk(new Date(D(dk())-30*864e5)));
    const ch30=ago>=0&&ago<a.length-1?last-av[ago]:null;
    tiles=`<div class="stat-g">
      <div class="stat"><div class="k">7-day average</div><div class="v">${n1(last)}<small> kg</small></div><div class="n">today's weigh-in ${n1(a[a.length-1].w)}</div></div>
      <div class="stat"><div class="k">Last 30 days</div><div class="v">${ch30==null?'–':(ch30>0?'+':'')+n1(ch30)}<small> kg</small></div><div class="n">7-day average vs 30 days ago</div></div></div>`;
    if(tr&&tr.rate!==undefined){const ok=tr.rate>=CFG.bw.lo&&tr.rate<=CFG.bw.hi;
      tiles+=`<div class="note ${ok?'ok':'warn'}">Trending <b>${tr.rate>0?'+':''}${(CFG.bw.per||30)<10?Math.round(tr.rate*100)/100:n1(tr.rate)} kg / ${(CFG.bw.per||30)<10?'week':'month'}</b>${(CFG.bw.per||30)<10&&tr.cur?' ('+(tr.rate>0?'+':'')+n1(tr.rate/tr.cur*100)+'% of bodyweight)':''}. ${CFG.bw.msg(tr.rate,ok)}</div>`}
    else tiles+=`<div class="note">${CFG.bw.cap} The trend shows once there are 4–5 weeks of weigh-ins.</div>`;
  }
  const rng=['1m','3m','6m','all'].map(r=>`<button class="chip${bwRange===r?' on':''}" onclick="bwRange='${r}';try{localStorage.setItem(KBWR,JSON.stringify(bwRange))}catch(e){};render()">${r==='all'?'All':r.toUpperCase()}</button>`).join('');
  const list=a.slice().reverse(), shown=list.slice(0,14);
  return `<div class="dv active">
   <div class="card"><h4>Log a weigh-in</h4><div class="cap">Daily, first thing in the morning, after the toilet, before food. The single number is noise — the line is the 7-day average.</div>
    <div class="bwrow"><input id="bwDate" type="date" value="${dk()}" max="${dk()}"><input id="bwIn" type="number" step="0.1" inputmode="decimal" placeholder="${a.length?n1(a[a.length-1].w):'kg'}"><button onclick="saveBW()">Save</button></div></div>
   <div class="card"><div class="chart-h"><h4>Bodyweight</h4><div class="chips sm">${rng}</div></div>
    ${a.length?`<div class="legend"><span><i class="lg-dot"></i>Daily weigh-in</span><span><i class="lg-line"></i>7-day average</span></div><div class="chart" id="bwChart"></div>`:'<div class="note">No weigh-ins yet. Log today above, or paste your old records below.</div>'}
    ${tiles}</div>
   ${a.length?weeklyHTML(a):''}
   ${a.length?`<div class="card"><h4>Entries <span class="muted">${a.length}</span></h4>
    ${shown.map((x,i)=>{const p=list[i+1],dl=p?x.w-p.w:null;
      return `<div class="bwl"><span>${fmtD(x.d)}</span><b>${n1(x.w)} kg</b><span class="dl">${dl==null?'':(dl>0?'+':'')+n1(dl)}</span><button onclick="delBW('${x.d}')" aria-label="Remove">×</button></div>`}).join('')}
    ${list.length>14?`<details><summary>All ${list.length} entries</summary>${list.slice(14).map(x=>`<div class="bwl"><span>${fmtD(x.d)} ${x.d.slice(0,4)}</span><b>${n1(x.w)} kg</b><span class="dl"></span><button onclick="delBW('${x.d}')" aria-label="Remove">×</button></div>`).join('')}</details>`:''}</div>`:''}
   <div class="card"><details${a.length?'':' open'}><summary><h4 style="display:inline">Import old records</h4></summary>
    <div class="cap" style="margin-top:6px">Paste one weigh-in per line — <b>14.10 73.4</b>, <b>2026-10-14 73.4</b> or <b>Oct 14 — 73,4</b>. Dates are read day-first. If your list has <b>no dates</b> (just weights, oldest first, one per day), set the date of the LAST line here:</div>
    <div class="bwrow"><input id="imEnd" type="date" value="${dk()}" max="${dk()}"></div>
    <textarea id="imTxt" rows="7" placeholder="12.10 73.1&#10;13.10 72.9&#10;14.10 73.4"></textarea>
    <div id="imPrev" class="note" style="display:none"></div>
    <div class="bwrow" style="margin-top:8px"><button class="ghost" onclick="importBW(false)">Preview</button><button onclick="importBW(true)">Import</button></div></details></div>
  </div>`;
}
/* one row per calendar week (Mon–Sun): average, change vs the week before, pace */
function weeklyHTML(a){
  const per=CFG.bw.per||30, lo=CFG.bw.lo*7/per, hi=CFG.bw.hi*7/per, wk={};
  a.forEach(x=>{const m=monday(x.d);(wk[m]=wk[m]||[]).push(x.w)});
  const ks=Object.keys(wk).sort(), cur=monday(dk());
  const rows=ks.map((m,i)=>{const v=wk[m],avg=v.reduce((s,x)=>s+x,0)/v.length;
    const p=i?wk[ks[i-1]]:null, pa=p?p.reduce((s,x)=>s+x,0)/p.length:null;
    const gap=i?Math.round((D(m)-D(ks[i-1]))/(7*864e5)):1;
    const dl=pa==null?null:(avg-pa)/gap;
    const mk=(CFG.marks||[]).find(k=>monday(k.d)<=m&&(D(m)-D(monday(k.d)))/864e5<21);
    let st='',cls='';
    if(dl!=null&&v.length>=3){
      if(dl>=lo&&dl<=hi){st='on pace';cls='ok'}
      else if(dl<lo){st=CFG.bw.lo<0?'too fast':'too slow';cls='warn'}
      else{st=CFG.bw.lo<0?(dl>0?'gained':'slow'):'too fast';cls='warn'}
      if(mk&&cls==='warn'&&dl>lo)st+=' · '+mk.t;
    }
    const sun=D(m);sun.setDate(sun.getDate()+6);const s0=D(m);
    const lbl=s0.getMonth()===sun.getMonth()?s0.getDate()+'–'+sun.getDate()+' '+MON[sun.getMonth()]:s0.getDate()+' '+MON[s0.getMonth()]+' – '+sun.getDate()+' '+MON[sun.getMonth()];
    return `<div class="wkr"><span class="wl">${lbl}${m===cur?'<small>so far · '+v.length+' day'+(v.length>1?'s':'')+'</small>':v.length<7?'<small>'+v.length+' weigh-ins</small>':''}</span>
      <b>${n1(avg)}</b><span class="wd">${dl==null?'–':(dl>0?'+':'')+(Math.round(dl*100)/100).toFixed(2)}<small>${dl==null?'':(dl>0?'+':'')+n1(dl/pa*100)+'%'}</small></span>
      <span class="ws ${cls}">${st}</span></div>`}).reverse();
  return `<div class="card"><h4>Week by week</h4><div class="cap">Average of each Mon–Sun week and the change from the week before. Target ${Math.round(Math.abs(hi)*100)/100}–${Math.round(Math.abs(lo)*100)/100} kg a week${CFG.bw.lo<0?' down':''}. Weeks with fewer than 3 weigh-ins aren't judged.</div>
    <div class="wkr wkh"><span>Week</span><span>Avg kg</span><span>Change</span><span></span></div>${rows.join('')}</div>`;
}
function drawBW(){
  const el=document.getElementById('bwChart');if(!el)return;
  let a=bwAll();
  const days={'1m':31,'3m':92,'6m':183}[bwRange];
  const avAll=bwAvg(a);
  let idx=a.map((_,i)=>i);
  if(days){const cut=dk(new Date(D(dk())-days*864e5));idx=idx.filter(i=>a[i].d>=cut)}
  if(!idx.length)idx=[a.length-1];
  const pts=idx.map(i=>({d:a[i].d,w:a[i].w,av:avAll[i],t:+D(a[i].d)}));
  const Wd=el.clientWidth||340, H=210, L=38, R=10, T=10, B=24;
  const t0=pts[0].t, t1=Math.max(pts[pts.length-1].t,t0+864e5);
  const vs=pts.flatMap(p=>[p.w,p.av]);let lo=Math.min(...vs), hi=Math.max(...vs);
  const span=Math.max(hi-lo,1.2), step=span>6?2:span>3?1:.5;
  lo=Math.floor((lo-.15)/step)*step; hi=Math.ceil((hi+.15)/step)*step;
  const X=t=>L+(t-t0)/(t1-t0)*(Wd-L-R), Y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
  let g='';
  for(let v=lo;v<=hi+1e-9;v+=step)g+=`<line x1="${L}" x2="${Wd-R}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${L-6}" y="${Y(v)+3.5}" class="ax" text-anchor="end">${n1(v)}</text>`;
  const nT=Math.min(4,pts.length);
  for(let k=0;k<nT;k++){const t=t0+(t1-t0)*(nT===1?0:k/(nT-1)),dd=new Date(t);
    g+=`<text x="${X(t)}" y="${H-6}" class="ax" text-anchor="${k===0?'start':k===nT-1?'end':'middle'}">${dd.getDate()} ${MON[dd.getMonth()]}</text>`}
  (CFG.marks||[]).forEach(m=>{const t=+D(m.d);if(t<t0||t>t1)return;
    g+=`<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${H-B}" class="mk"/><text x="${X(t)+4}" y="${T+9}" class="mkt">${m.t}</text>`});
  const dots=pts.map(p=>`<circle cx="${X(p.t)}" cy="${Y(p.w)}" r="${pts.length>120?1.8:2.6}" class="dot"/>`).join('');
  const line=pts.map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+' '+Y(p.av).toFixed(1)).join('');
  const lp=pts[pts.length-1];
  el.innerHTML=`<svg width="${Wd}" height="${H}" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Bodyweight chart">${g}${dots}
    <path d="${line}" class="avg"/><circle cx="${X(lp.t)}" cy="${Y(lp.av)}" r="4.5" class="end"/>
    <line id="xh" class="xh" y1="${T}" y2="${H-B}" style="display:none"/><circle id="xd" r="5" class="end" style="display:none"/>
    <rect x="${L}" y="0" width="${Wd-L-R}" height="${H}" fill="transparent" id="xhit"/></svg><div class="tip" id="tip"></div>`;
  const hit=el.querySelector('#xhit'), xh=el.querySelector('#xh'), xd=el.querySelector('#xd'), tip=el.querySelector('#tip');
  const show=ev=>{const r=hit.getBoundingClientRect(), cx=(ev.touches?ev.touches[0].clientX:ev.clientX)-r.left+L;
    let b=pts[0];for(const p of pts)if(Math.abs(X(p.t)-cx)<Math.abs(X(b.t)-cx))b=p;
    const x=X(b.t);xh.setAttribute('x1',x);xh.setAttribute('x2',x);xh.style.display='';
    xd.setAttribute('cx',x);xd.setAttribute('cy',Y(b.av));xd.style.display='';
    tip.innerHTML=`<b>${fmtD(b.d)}</b><span>${n1(b.w)} kg weigh-in</span><span>${n1(b.av)} kg average</span>`;
    tip.style.display='block';tip.style.left=Math.max(0,Math.min(Wd-tip.offsetWidth,x-tip.offsetWidth/2))+'px'};
  const hide=()=>{xh.style.display=xd.style.display=tip.style.display='none'};
  hit.addEventListener('pointermove',show);hit.addEventListener('pointerdown',show);
  hit.addEventListener('touchmove',e=>{show(e);e.preventDefault()},{passive:false});
  hit.addEventListener('pointerleave',hide);
}
function parseBW(txt,end){
  const lines=txt.split(/\n/).map(s=>s.trim()).filter(Boolean), out=[], plain=[];
  const now=dk(), yr=new Date().getFullYear();
  const mi=s=>MON.findIndex(m=>s.toLowerCase().startsWith(m.toLowerCase()));
  const mk=(y,m,d)=>{if(m<1||m>12||d<1||d>31)return null;let s=y+'-'+pad(m)+'-'+pad(d);
    if(y===yr&&s>now)s=(y-1)+'-'+pad(m)+'-'+pad(d);return s};
  const wOf=s=>{const m=s.replace(/,/g,'.').match(/\d{2,3}(?:\.\d+)?/g)||[];const v=m.map(Number).find(v=>v>=30&&v<=250);return v};
  for(const ln of lines){let d=null,rest=ln,m;
    if(m=ln.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/))d=mk(+m[1],+m[2],+m[3]);
    else if(m=ln.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?(?![\d,]|\.\d)/)){let a=+m[1],b=+m[2],y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):yr;
      if(b>12&&a<=12)[a,b]=[b,a];d=mk(y,b,a)}
    else if(m=ln.match(/\b([A-Za-z]{3,})\.?\s+(\d{1,2})\b/)){const k=mi(m[1]);if(k>=0)d=mk(yr,k+1,+m[2])}
    if(!d&&(m=ln.match(/\b(\d{1,2})\s+([A-Za-z]{3,})/))){const k=mi(m[2]);if(k>=0)d=mk(yr,k+1,+m[1])}
    if(m&&d)rest=ln.replace(m[0],' ');
    const w=wOf(rest);if(w==null)continue;
    if(d)out.push({d,w});else plain.push(w)}
  if(!out.length&&plain.length){const e=D(end||now);
    plain.forEach((w,i)=>{const t=new Date(e);t.setDate(t.getDate()-(plain.length-1-i));out.push({d:dk(t),w})})}
  return out;
}
function importBW(go){
  const r=parseBW(document.getElementById('imTxt').value,document.getElementById('imEnd').value), pv=document.getElementById('imPrev');
  pv.style.display='block';
  if(!r.length){pv.className='note warn';pv.textContent='Couldn\'t read any weigh-ins from that. One per line, a date and a weight.';return}
  r.sort((a,b)=>a.d<b.d?-1:1);
  if(!go){pv.className='note';pv.innerHTML=`Read <b>${r.length}</b> weigh-ins, ${fmtD(r[0].d)} ${r[0].d.slice(0,4)} → ${fmtD(r[r.length-1].d)} ${r[r.length-1].d.slice(0,4)}.<br>First: ${n1(r[0].w)} kg · last: ${n1(r[r.length-1].w)} kg. Tap Import if that's right.`;return}
  const a=J(KBW,[]),t=Date.now();
  r.forEach(x=>{const i=a.findIndex(y=>y.d===x.d),e={d:x.d,w:x.w,t};if(i>=0)a[i]=e;else a.push(e)});
  a.sort((x,y)=>x.d<y.d?-1:1);W(KBW,a);queueSync();render();toast('Imported '+r.length+' weigh-ins');
}
function saveBW(){const i=document.getElementById('bwIn'),v=i.value.trim().replace(',','.'),d=document.getElementById('bwDate').value||dk();
  if(!v||!(+v>30&&+v<250)){toast('Enter a weight');return}
  logBW(v,d);render();toast('Logged '+n1(+v)+' kg · '+fmtD(d))}

/* ═══════════ stats tab ═══════════ */
function statsHTML(){
  const plan=plannedVol(), act=actualVol(7);
  const order=Object.keys(plan).sort((a,b)=>plan[b]-plan[a]);
  const pct=v=>Math.min(100,v/SCALE*100);
  const wc=weekCounts(4), logged=wc[3].n, full=logged>=PROG.length-1;
  const rows=order.map(m=>{
    const p=plan[m], a=act[m]||0;
    const cls = !full ? '' : a<CFG.band[0]&&p>=CFG.band[0] ? 'low' : a>CFG.band[1] ? 'high' : '';
    return `<div class="vr"><span class="vm">${m}</span>
      <span class="vtr"><span class="band" style="left:${CFG.band[0]/SCALE*100}%;width:${(CFG.band[1]-CFG.band[0])/SCALE*100}%"></span>
        <span class="fill ${cls}" style="width:${pct(a)}%"></span>
        <span class="plan" style="left:${pct(p)}%"></span></span>
      <span class="vn ${cls}">${a%1?a.toFixed(1):a}<span style="color:var(--t4);font-weight:500">/${p%1?p.toFixed(1):p}</span></span></div>`;
  }).join('');
  const tgt=PROG.length;
  const weeks=wc.map(o=>`<div class="${o.n>=tgt?'good':o.n>0?'miss':''}"><div class="n">${o.n}</div><div class="l">${o.w>0?'W'+o.w:'–'}</div></div>`).join('');
  const st=stalls();
  const stallBody = st.length
    ? st.map(s=>`<div class="stall">${s} — <b>no gain in 3 sessions</b></div>`).join('')
      +`<div class="note">Stalling on one or two lifts is normal. Half the list stalling at once means it's time for the deload week.</div>`
    : `<div class="note ok">Nothing stalled. Every lift with three logged sessions on the same day has moved.</div>`;
  const key=syncKey(), last=+localStorage.getItem(KSY)||0;
  const syncBody=key
    ? `<div class="note ${syncState==='err'?'warn':'ok'}">${syncState==='err'?'Offline — your sets are safe on the phone and upload when you\'re back online.':'On. Every set and weigh-in is backed up to the cloud and shared between Safari and the home-screen app.'}${last?' Last saved '+new Date(last).toLocaleString([], {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'.':''}</div>
       <button class="btn sec" onclick="sync().then(()=>{render();toast('Synced')})">Sync now</button>`
    : `<div class="note warn">Off — your log lives only in this browser. Paste your sync code to back it up.</div>
       <div class="bwrow" style="margin-top:9px"><input id="skIn" placeholder="sync code" autocapitalize="off" autocorrect="off" spellcheck="false"><button onclick="setKey()">Turn on</button></div>`;
  return `<div class="dv active">
   <div class="card"><h4>Cloud backup</h4>${syncBody}</div>
   <div class="card"><h4>Weekly volume by muscle</h4>
     <div class="cap">Filled bar = sets you actually logged in the last 7 days. The line is what the programme prescribes; ${CFG.bandNote}${full?'':' <b>'+logged+' of '+PROG.length+' sessions in so far</b> — colours hold off until the week is nearly done.'}</div>
     ${rows}</div>
   <div class="card"><h4>Consistency</h4>
     <div class="cap">Sessions per programme week.</div>
     <div class="wk">${weeks}</div></div>
   <div class="card"><h4>Progression check</h4>
     <div class="cap">Best set (weight × reps) versus three sessions ago, on the same day.</div>
     ${stallBody}</div></div>`;
}

/* ═══════════ add-to-home-screen guide (iPhone, not yet installed) ═══════════ */
function installHTML(){
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent), inst=navigator.standalone||matchMedia('(display-mode: standalone)').matches;
  let off=false;try{off=localStorage.getItem(K+'nohint')==='1'}catch(e){}
  if(!ios||inst||off)return '';
  const inApp=/FBAN|FBAV|Instagram|Telegram|Line\/|Messenger|GSA\//.test(navigator.userAgent);
  return `<div class="inst"><b>Put this on your home screen</b>
   <ol>${inApp?'<li>You\'re inside another app\'s browser — tap <b>•••</b> and choose <b>Open in Safari</b> first.</li>':''}
   <li>In Safari tap <b>•••</b> at the bottom right (or the <b>Share</b> icon <span class="shr">⬆︎</span>).</li>
   <li>Tap <b>Share</b> if needed, scroll down, tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>
   <span class="cap2">Not in the list? Scroll to the bottom → Edit Actions → add it. Your log is the same in Safari and in the app.</span>
   <button onclick="try{localStorage.setItem(K+'nohint','1')}catch(e){};render()">Done — hide this</button></div>`;
}

/* ═══════════ actions ═══════════ */
function swapTo(si,xi,v){setVar(day,si,v);render();toast(v?'Swapped in':'Back to the main lift')}
function mark(si,xi,i){
  const sl=PROG[day].slots[si], x=sl.ex[xi];
  const v=varOf(day,si), xid=variantId(x,v), xn=variantName(x,v);
  const wi=document.getElementById(`w-${si}-${xi}-${i}`), pi=document.getElementById(`p-${si}-${xi}-${i}`);
  const row=document.getElementById(`r-${si}-${xi}-${i}`);
  if(row.classList.contains('done')){
    unlogSet(xid,i);row.classList.remove('done');
    row.closest('.ex').querySelector('.ex-badge').classList.remove('done');
    paint();refreshHist(si,xi);return;
  }
  const w=(wi.value.trim()||wi.placeholder||(x.bw?'0':'')).replace(',','.'), r=pi.value.trim()||pi.placeholder;
  if(!w||!r){toast('Weight and reps first');wi.focus();return}
  wi.value=w;pi.value=r;
  logSet(xid,i,w,r);clearDraft([wi.id,pi.id]);
  row.classList.add('done');
  const t=today(xid);
  if(t&&live(t).length>=x.s)document.querySelector(`#ex-${si}-${xi} .ex-badge`).classList.add('done');
  refreshHist(si,xi);paint();
  if(i+1<x.s) startRest(sl.rest, xn, x.myo?`then ${i?'another':'the first'} mini-set of 5`:`set ${i+2} of ${x.s}`);
  else{const nx=PROG[day].slots[si+1];
    if(nx)startRest(Math.max(sl.rest,90),'Next exercise',variantName(nx.ex[0],varOf(day,si+1)));
    else skipRest()}
  const ss=sessionSets(); if(ss.done===ss.total)setTimeout(finish,900);
}
function refreshHist(si,xi){
  const el=document.getElementById(`h-${si}-${xi}`);
  const x=PROG[day].slots[si].ex[xi];
  if(el)el.innerHTML=histHTML(variantId(x,varOf(day,si)),PROG[day].sh);
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
  const tgtAvg=Math.round(tgt/tn)+40;
  const over=avg-tgtAvg, lost=Math.round(over*gaps.length/60);
  const w=x=>Math.floor(x/60)+':'+pad(x%60);
  document.getElementById('sheetIn').innerHTML=`
   <h3>${PROG[day].lb}</h3><div class="sub">Week ${weekNo(dk())} · ${done} of ${total} sets logged</div>
   <div class="stat-g">
     <div class="stat"><div class="k">Session</div><div class="v">${mins} min</div><div class="n">first set to last</div></div>
     <div class="stat"><div class="k">Sets done</div><div class="v">${done}/${total}</div><div class="n">${Math.round(done/total*100)}% of the plan</div></div>
     <div class="stat"><div class="k">Avg per set</div><div class="v">${w(avg)}</div><div class="n">work + rest</div></div>
     <div class="stat"><div class="k">Target</div><div class="v">${w(tgtAvg)}</div><div class="n">prescribed pace</div></div>
   </div>
   ${over>25
     ? `<div class="verdict warn">You're running <b>${w(over)} slower per set</b> than prescribed — about <b>${lost} minutes</b> added to this session. Let the timer run the rests and this session becomes ~${Math.max(30,mins-lost)} min.</div>`
     : over<-20
     ? `<div class="verdict">You're resting <b>${w(-over)} less per set</b> than prescribed. Let the timer finish — short rests cost growth on the heavy lifts.</div>`
     : `<div class="verdict">Pace is on target.</div>`}
   <button class="btn" onclick="document.getElementById('sheet').classList.remove('show')">Done</button>`;
  document.getElementById('sheet').classList.add('show');
}
function exportJSON(){
  const s=JSON.stringify({exported:new Date().toISOString(),...buildDoc()},null,1);
  navigator.clipboard?.writeText(s).then(()=>toast('Copied to clipboard'),()=>{});
  const win=window.open('','_blank');
  if(win){win.document.write('<pre style="font:12px/1.4 monospace;white-space:pre-wrap;word-break:break-all">'+
    s.replace(/[<&]/g,c=>({'<':'&lt;','&':'&amp;'}[c]))+'</pre>');win.document.close()}
  else toast('Copied — paste somewhere safe');
}

/* ═══════════ boot ═══════════ */
if(CFG.migrate)CFG.migrate();
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
day=Math.max(0,PROG.findIndex(d=>d.dw===new Date().getDay()));
render();
setSync(syncKey()?'pending':'off');sync();
setInterval(paint,30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){sync();if(day<PROG.length)paint()}});
addEventListener('online',sync);
addEventListener('resize',()=>{if(day===BW)drawBW()});
document.getElementById('sheet').addEventListener('click',e=>{
  if(e.target.id==='sheet')e.currentTarget.classList.remove('show')});
