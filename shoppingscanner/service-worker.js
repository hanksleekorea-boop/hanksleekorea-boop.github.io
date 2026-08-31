const RELEASE="v88-two-stage-acceptance-execution-r1";
const CACHE_PREFIX='shopping-scanner-shell-';
const CACHE_NAME=CACHE_PREFIX+RELEASE;
const SHELL=['/shoppingscanner/','/shoppingscanner/en/','/shoppingscanner/privacy/','/shoppingscanner/terms/','/shoppingscanner/accessibility/','/shoppingscanner/cookies/','/shoppingscanner/advertising/','/shoppingscanner/en/privacy/','/shoppingscanner/en/terms/','/shoppingscanner/en/cookies/','/shoppingscanner/en/advertising/','/shoppingscanner/ad-operations/','/shoppingscanner/quality-status/','/shoppingscanner/innovation-lab/','/shoppingscanner/acceptance-center/','/shoppingscanner/stage1-readiness.json','/shoppingscanner/development-readiness.json','/shoppingscanner/manifest.webmanifest','/shoppingscanner/global-commercial.css','/shoppingscanner/global-commercial.js','/shoppingscanner/global-commercial-config.json','/shoppingscanner/stage1-trust.css','/shoppingscanner/stage1-trust-core.mjs','/shoppingscanner/stage1-trust-runtime.mjs','/shoppingscanner/innovation-lab.css','/shoppingscanner/innovation-lab.mjs','/shoppingscanner/stage2-expansion-core.mjs','/shoppingscanner/acceptance-center.css','/shoppingscanner/acceptance-center.mjs','/shoppingscanner/acceptance-execution-core.mjs','/shoppingscanner/pwa-icon-192.png','/shoppingscanner/pwa-icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  clients.forEach(client=>client.postMessage({type:'SHOPPING_SCANNER_OFFLINE_READY',release:RELEASE}));
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SHOPPING_SCANNER_SKIP_WAITING')self.skipWaiting();});
async function networkFirst(request,fallback='/shoppingscanner/'){
  const cache=await caches.open(CACHE_NAME);
  try{const response=await fetch(request);if(response&&response.ok)await cache.put(request,response.clone());return response;}
  catch(error){const cached=await cache.match(request,{ignoreSearch:true})||await cache.match(fallback);if(cached)return cached;throw error;}
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate')return event.respondWith(networkFirst(request,'/shoppingscanner/'));
  if(url.pathname.startsWith('/shoppingscanner/catalog/'))return event.respondWith(networkFirst(request));
  if(SHELL.includes(url.pathname))return event.respondWith(caches.match(request,{ignoreSearch:true}).then(hit=>hit||fetch(request)));
});