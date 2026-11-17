/* Offline shell. Network first (so a push to GitHub shows up at once),
   the cached copy only when the gym's signal is gone. Never touches sync. */
const C='gym-shell-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith((async()=>{
    const net=fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c))}return r});
    const cached=caches.match(e.request,{ignoreSearch:true});
    const slow=new Promise(res=>setTimeout(()=>cached.then(c=>c&&res(c)),3500));
    try{return await Promise.race([net,slow])}catch(err){return (await cached)||Response.error()}
  })());
});
