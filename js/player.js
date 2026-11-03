// Плеер прямых трансляций (HLS / .m3u8). Использует hls.js (js/vendor, лицензия Apache-2.0)
// или встроенную поддержку браузера (Safari, iPhone, Android).

let hlsPromise = null;

function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsPromise) {
    hlsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/hls.light.min.js';
      s.onload = () => resolve(window.Hls);
      s.onerror = () => { hlsPromise = null; reject(new Error('Не удалось загрузить плеер')); };
      document.head.append(s);
    });
  }
  return hlsPromise;
}

const ERR_TEXT = 'Канал сейчас не открывается: он может не вещать, быть доступен только в своей стране или не разрешать показ на других сайтах.';

/**
 * Запускает трансляцию в <video>. Возвращает функцию остановки.
 * onState('loading' | 'playing' | 'error', текст?)
 */
export function playStream(video, url, onState) {
  let hls = null;
  let stopped = false;
  let usedNative = false;

  const fail = (msg) => { if (!stopped) onState('error', msg || ERR_TEXT); };
  const tryPlay = () => video.play().catch(() => { /* автозапуск запрещён — пользователь нажмёт ▶ */ });
  video.addEventListener('playing', () => { if (!stopped) onState('playing'); });

  async function viaHlsJs() {
    let Hls;
    try { Hls = await loadHls(); } catch (e) { return fail(e.message); }
    if (stopped) return;
    if (!Hls || !Hls.isSupported()) return fail('Этот браузер не умеет показывать прямые трансляции. Попробуйте Chrome или Safari.');
    let recovered = false;
    hls = new Hls({ backBufferLength: 30, manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 2 });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal || stopped) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) { recovered = true; hls.recoverMediaError(); return; }
      hls.destroy();
      hls = null;
      fail();
    });
    hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
    hls.loadSource(url);
    hls.attachMedia(video);
  }

  onState('loading');
  // Встроенный плеер (iPhone, Safari, Android) не требует разрешений от сервера канала — пробуем его первым
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    usedNative = true;
    video.addEventListener('error', () => {
      if (stopped || !usedNative) return;
      usedNative = false;
      video.removeAttribute('src');
      video.load();
      viaHlsJs();
    }, { once: true });
    video.src = url;
    tryPlay();
  } else {
    viaHlsJs();
  }

  return () => {
    stopped = true;
    if (hls) hls.destroy();
    hls = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
}
