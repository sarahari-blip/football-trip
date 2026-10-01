/* FOOTBALL TRIP - アクセス計測（GTM / GA4 / Microsoft Clarity）
   ・config.js の FT.config.analytics にIDを入れるまでは、何も読み込まず、何も送信しません。
   ・訪問者が「同意する」を押すまでは、計測タグを読み込みません。
   ・入力内容（予算・クラブ名・日程など）は送りません。送るのはページ名とボタン操作の名前だけです。
   ・サーチコンソールは訪問者の計測ではなく所有者確認です（index.html の <head> に設定）。 */
globalThis.FT = globalThis.FT || {};
(function () {
  const FT = globalThis.FT;
  const C = (FT.config && FT.config.analytics) || {};
  const KEY = 'ft.consent.v1';
  // 形式が正しいIDだけ有効にする（誤入力や不正な値でスクリプトを読み込まないため）
  const ok = {
    gtm: /^GTM-[A-Z0-9]{4,12}$/.test(C.gtm || ''),
    ga4: /^G-[A-Z0-9]{4,14}$/.test(C.ga4 || ''),
    clarity: /^[a-z0-9]{6,16}$/i.test(C.clarity || ''),
  };
  const enabled = ok.gtm || ok.ga4 || ok.clarity;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  let loaded = false;

  const getConsent = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const setConsent = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* 保存できない場合は毎回確認 */ } };
  const addScript = src => { const s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); };

  function load() {
    if (loaded || !enabled) return;
    loaded = true;
    // 同意モード：広告関連は常に拒否、計測のみ許可
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
    gtag('consent', 'update', { analytics_storage: 'granted' });
    if (ok.gtm) {
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      addScript('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(C.gtm));
    }
    if (ok.ga4) {
      addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(C.ga4));
      gtag('js', new Date());
      gtag('config', C.ga4, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    }
    if (ok.clarity) {
      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', C.clarity);
      window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
    }
  }

  // 送る値は「イベント名」と、個人や入力内容を含まない値だけ
  function track(name, params) {
    if (!loaded) return;
    params = params || {};
    if (ok.gtm) window.dataLayer.push(Object.assign({ event: name }, params));
    if (ok.ga4) gtag('event', name, params);
  }
  function pageview(path) {
    // タイトルには出発日などが入ることがあるため、固定の文言だけを送る
    track('page_view', { page_path: path, page_title: 'FOOTBALL TRIP' });
  }

  // ---- 同意バナー ----
  const box = () => document.getElementById('consent');
  function renderBanner() {
    const el = box(); if (!el) return;
    if (!enabled || getConsent() !== null) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="consent-inner" role="dialog" aria-labelledby="consent-t">
      <p id="consent-t"><b>アクセス状況の計測について</b><br>サービス改善のため、Google（Googleアナリティクス・タグマネージャー）とMicrosoft（Clarity）でアクセス状況を計測します。ページの閲覧やボタン操作の記録が外部に送信され、Cookieを使います。<b>入力した予算・クラブ名・日程などは送りません。</b>詳しくは<a href="#/privacy">プライバシーと計測について</a>をご覧ください。</p>
      <div class="consent-btns"><button type="button" class="btn btn-primary btn-sm" data-consent="granted">同意する</button><button type="button" class="btn btn-ghost btn-sm" data-consent="denied">同意しない</button></div></div>`;
  }
  function decide(v, currentPath) {
    setConsent(v); renderBanner();
    if (v === 'granted') { load(); pageview(currentPath || '/'); }
    else if (loaded) location.reload(); // 取り消し：読み込み済みのタグを止めるため再読み込み
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-consent]');
    if (b) { decide(b.dataset.consent, FT.analytics.currentPath); return; }
    if (ev.target.closest('[data-consent-reset]')) { try { localStorage.removeItem(KEY); } catch (e) { /* 何もしない */ } if (loaded) location.reload(); else renderBanner(); }
  });

  FT.analytics = {
    enabled, status: ok, currentPath: '/',
    consent: getConsent,
    track, pageview: p => { FT.analytics.currentPath = p; pageview(p); },
    init() { renderBanner(); if (getConsent() === 'granted') load(); },
  };
  document.addEventListener('DOMContentLoaded', () => FT.analytics.init());
})();
