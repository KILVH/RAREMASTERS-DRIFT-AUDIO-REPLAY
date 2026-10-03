// Scope-specific cache cannot delete another GitHub Pages game's cache.
const PREFIX='raremasters-mobile-'+new URL(self.registration.scope).pathname+'-';
const CACHE=PREFIX+'audio-replay-1';
const CORE=['./','index.html','style.css','manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin||event.request.headers.has('range'))return;
 const url=new URL(event.request.url),asset=/\.(webp|png|mp3|surface)$/.test(url.pathname);
 event.respondWith((async()=>{const cache=await caches.open(CACHE);if(asset){const saved=await cache.match(event.request);if(saved)return saved;}
 try{const response=await fetch(event.request);if(response.status===200){const copy=response.clone();event.waitUntil(cache.put(event.request,copy));}return response;}
 catch(e){return await cache.match(event.request)||new Response('Материал ещё не загружен. Подключитесь к сети.',{status:503});}})());
});
