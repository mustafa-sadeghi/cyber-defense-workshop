const CACHE='cyber-aware-v4';
const CORE=['./','./index.html','./styles.css','./app.js'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  // Keep third-party evidence images under their original publishers' control.
  if(url.origin!==self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      return res;
    }).catch(()=>{
      if(e.request.destination==='document') return caches.match('./index.html');
      return new Response('',{status:504,statusText:'Offline resource unavailable'});
    }))
  );
});
