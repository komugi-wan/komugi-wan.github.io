const CACHE_NAME = 'coll-archive-v4.0.0'; // バージョンアップ
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// インストール時にコアアセットをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching assets');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ネットワーク優先、失敗したらキャッシュを返す（動的データ対応のため）
// ただし、起動時の真っ暗時間を防ぐため、HTMLはキャッシュがある場合は即座に返すべきですが、
// 本アプリはLocalStorage依存のため、ネットワークが不安定な場合を考慮し、フェッチ戦略を維持します。
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
