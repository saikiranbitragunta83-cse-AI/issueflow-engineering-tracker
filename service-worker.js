// Service worker caches ONLY the public app shell, never passwords or cloud APIs.
const CACHE='issueflow-static-v2-20261123';
const APP_FILES=['./','./index.html','./assets/styles.css','./assets/app.js','./assets/core.js','./assets/cloud.js','./assets/config.js','./assets/favicon.svg','./assets/icon-192.png','./assets/icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin || !url.pathname.startsWith(new URL('./',self.registration.scope).pathname))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return response;}).catch(()=>caches.match('./index.html')));
  }else{
    // Network-first also refreshes public config.js when the site owner enables cloud.
    event.respondWith(fetch(req).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
      return response;
    }).catch(()=>caches.match(req)));
  }
});
