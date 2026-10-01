/* FOOTBALL TRIP - 画面の動き（ルーティング・フォーム・結果・詳細・保存・印刷） */
(function () {
  const FT = globalThis.FT, D = FT.data, P = FT.planner, U = P.util;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
  const ic = (n, cls) => `<svg class="ic ${cls || ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const cityJa = id => (D.cities[id] ? D.cities[id].ja : id);
  const app = $('#app');
  // アクセス計測（イベント名のみ送信。入力内容は送らない）
  const track = (n, p) => { try { if (FT.analytics) FT.analytics.track(n, p); } catch (e) { /* 計測の失敗で画面を止めない */ } };

  // ---------- 保存（端末内：localStorage） ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };
  const getSaved = () => store.get('ft.saved.v1', []);
  const setSaved = list => store.set('ft.saved.v1', list);

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- 状態 ----------
  const monthOf = (days) => { const d = new Date(Date.now() + days * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const defaultInput = () => ({
    clubs: [], origin: 'HND', dateMode: 'month', month: monthOf(35), days: 7, depart: '', ret: '',
    budget: 500000, people: 2, style: 'sightsee', interests: ['walk', 'gourmet'], matchCount: 1, manual: [],
  });
  const sampleInput = () => ({ ...defaultInput(), clubs: ['arsenal', 'chelsea', 'mancity'], month: monthOf(45), days: 8, budget: 600000, interests: ['walk', 'gourmet', 'history'], matchCount: 2 });
  const state = { input: Object.assign(defaultInput(), store.get('ft.input.v1', {})), result: null, loading: false, loadError: null, clubQ: '' };
  if (!Array.isArray(state.input.clubs)) state.input = defaultInput();
  const saveInput = () => store.set('ft.input.v1', state.input);

  // ---------- 共通の部品 ----------
  const demoMeta = meta => !meta || meta.source === 'demo';
  const sourceLine = meta => demoMeta(meta)
    ? '情報源：デモデータ（架空）／確認日時：なし'
    : `情報源：${esc(meta.sourceName)}／確認日時：${esc(meta.fetchedAt)}`;
  const notice = (lv, html, icon) => `<div class="notice ${lv}" role="${lv === 'err' ? 'alert' : 'note'}">${ic(icon || (lv === 'warn' || lv === 'err' ? 'alert' : 'info'))}<div>${html}</div></div>`;
  const scopeNote = '対象は<b>プレミアリーグのリーグ戦のみ</b>です（カップ戦・欧州大会は含みません）。';
  const fmtKO = (m, gapDate) => {
    const t = U.toMin(m.time), gap = U.jstGap(gapDate || m.date), j = t + gap * 60;
    const hh = x => String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
    return `現地 ${m.time}${m.timeAssumed ? '（仮）' : ''}／日本時間 ${j >= 1440 ? '翌' : ''}${hh(j)}`;
  };

  function ticketExplainer() {
    return `<div class="expl">
      <div class="mini"><h4>${ic('ticket')}一般販売</h4><p class="small" style="color:inherit">会員でなくても買える販売です。ただし人気の試合は発売直後に売り切れることが多く、販売日や方法はクラブごとに違います。</p></div>
      <div class="mini"><h4>${ic('users')}会員向け販売</h4><p class="small" style="color:inherit">クラブの会員（有料メンバーシップなど）が先に買える販売です。会員になっても必ず買えるわけではなく、条件（会員歴・購入実績など）はクラブごとに異なります。</p></div>
      <div class="mini"><h4>${ic('stadium')}公式ホスピタリティ</h4><p class="small" style="color:inherit">食事やラウンジが付く特別席です。料金は高めですが、クラブ公式の窓口から買えます。内容と料金は試合ごとに違います。</p></div>
    </div>
    ${notice('warn', '<b>購入できるかどうかは、必ず公式サイトで確認してください。</b>このサイトでは販売状況を確認できないため、すべて「要確認」と表示します。SNSや非公式サイトでの個人売買は、無効なチケットや詐欺のおそれがあります。')}`;
  }

  function costBar(c) {
    const keys = ['flight', 'hotel', 'ticket', 'transport', 'food', 'sights'];
    const names = { flight: '航空券', hotel: '宿泊', ticket: 'チケット', transport: '現地交通', food: '食費', sights: '観光' };
    const tot = keys.reduce((s, k) => s + c[k], 0) || 1;
    return `<div class="bar" role="img" aria-label="費用の内訳">${keys.map(k => `<i class="c-${k}" style="width:${(c[k] / tot * 100).toFixed(1)}%"></i>`).join('')}</div>
    <div class="legend">${keys.map(k => `<span class="c-${k}">${names[k]}</span>`).join('')}</div>`;
  }

  // ---------- ルーター ----------
  function route(quiet) {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    const params = new URLSearchParams(qs || '');
    document.title = 'FOOTBALL TRIP｜海外サッカー観戦旅行プランナー';
    let key = 'home';
    if (path === '/plan') { key = 'plan'; viewPlan(); }
    else if (path === '/results') { key = 'plan'; viewResults(params); }
    else if (path.startsWith('/detail/')) { key = 'plan'; viewDetail(decodeURIComponent(path.slice(8))); }
    else if (path === '/saved') { key = 'saved'; viewSaved(); }
    else if (path === '/guide') { key = 'guide'; viewGuide(); }
    else if (path === '/privacy') { key = 'guide'; viewPrivacy(); }
    else viewHome();
    $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === key));
    if (FT.analytics) { if (!quiet) FT.analytics.pageview(path.startsWith('/detail/') ? '/detail' : path); const r = $('#consent-reset'); if (r) r.hidden = !FT.analytics.enabled; }
    window.scrollTo(0, 0);
  }

  // ---------- 1. トップ ----------
  function viewHome() {
    app.innerHTML = `
    <section class="hero">
      <svg class="pitch" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" fill="none" stroke="#fff" stroke-width="3">
        <rect x="40" y="40" width="720" height="420"/><line x1="400" y1="40" x2="400" y2="460"/><circle cx="400" cy="250" r="64"/>
        <rect x="40" y="150" width="110" height="200"/><rect x="650" y="150" width="110" height="200"/>
        <rect x="40" y="200" width="42" height="100"/><rect x="718" y="200" width="42" height="100"/>
      </svg>
      <div class="container">
        <span class="eyebrow">${ic('ball')}イングランド・プレミアリーグ対応</span>
        <h1>好きなクラブを選んで、<br><em>観戦旅行</em>をもっと簡単に。</h1>
        <p class="lead">観たいクラブ・時期・予算・日数を入れるだけ。試合観戦と観光、移動、宿泊を組み合わせた旅行プランを3つ比べられます。</p>
        <div class="cta">
          <a class="btn btn-primary btn-lg" href="#/plan">${ic('compass')}観戦旅行を計画する</a>
          <button class="btn btn-light btn-lg" data-action="sample" type="button">サンプル条件で試す</button>
        </div>
        <p class="small" style="color:#d6e3f5;margin-top:18px">※ 現在はデモ版です。試合日程は架空、料金は概算です。</p>
      </div>
    </section>
    <section class="block"><div class="container">
      <h2>3ステップで、旅行プランが完成</h2>
      <div class="steps">
        <div class="step"><span class="num">1</span><h3>条件を入れる</h3><p class="small" style="color:inherit">クラブ、出発地、時期、予算、人数、旅のスタイルを選びます。試合が決まっていれば手入力もできます。</p></div>
        <div class="step"><span class="num">2</span><h3>3つのプランを比べる</h3><p class="small" style="color:inherit">「費用を抑える」「バランス」「観戦優先」の3案を、総額・日程・移動で比較できます。</p></div>
        <div class="step"><span class="num">3</span><h3>保存・印刷する</h3><p class="small" style="color:inherit">気に入ったプランは端末に保存。印刷やPDF保存もできます。</p></div>
      </div>
    </div></section>
    <section class="block alt"><div class="container">
      <h2>初めての海外観戦でも安心</h2>
      <div class="feature-list">
        <div class="feature">${ic('clock')}<div><b>無理のない日程</b><p class="small" style="color:inherit">日本との時差、長いフライト、空港からの移動、スタジアムへの到着時間を考えて組みます。</p></div></div>
        <div class="feature">${ic('ticket')}<div><b>チケットは「要確認」を明示</b><p class="small" style="color:inherit">販売状況を確認できないものを「購入可能」とは表示しません。公式サイトへの案内つきです。</p></div></div>
        <div class="feature">${ic('yen')}<div><b>予算との差額が一目で分かる</b><p class="small" style="color:inherit">航空券込みの概算を、内訳つきで表示。足りないときは代替案も出します。</p></div></div>
        <div class="feature">${ic('book')}<div><b>はじめての観戦ガイド</b><p class="small" style="color:inherit">チケットの種類、当日の流れ、日程変更への備えをやさしく説明します。</p></div></div>
      </div>
    </div></section>
    <section class="block"><div class="container">
      <h2>対応クラブ（プレミアリーグ）</h2>
      <p class="small">${scopeNote}クラブ名はテキストで表記しています（公式ロゴは使用していません）。所属リーグは昇降格で変わるため、公式情報で確認してください。</p>
      <div class="clubs-row">${D.clubs.map(c => `<span class="tag">${esc(c.ja)}</span>`).join('')}</div>
      <p style="margin-top:28px"><a class="btn btn-primary" href="#/plan">${ic('arrow')}さっそく計画する</a> <a class="btn btn-ghost" href="#/guide">観戦ガイドを読む</a></p>
    </div></section>`;
  }

  // ---------- 2. 条件入力 ----------
  function viewPlan() {
    const i = state.input;
    const tomorrow = U.addDays(U.todayISO(), 1);
    const radio = (name, val, label, sub, checked) => `<label><input type="radio" name="${name}" value="${val}" ${checked ? 'checked' : ''}><span>${label}${sub ? `<small>${sub}</small>` : ''}</span></label>`;
    app.innerHTML = `
    <div class="page"><div class="container" style="max-width:820px">
      <h1>観戦旅行の条件を入力</h1>
      <p class="muted">分かる範囲で大丈夫です。あとから条件を変えて作り直せます。</p>
      ${notice('info', scopeNote + 'いまはデモ版のため、試合日程は架空です。')}
      <div id="err-summary" class="notice err err-summary" role="alert">${ic('alert')}<div>入力内容を確認してください。赤字の項目を直すとプランを作れます。</div></div>
      <form id="plan-form" novalidate data-clarity-mask="True">
        <section class="card form-sec" aria-labelledby="h-club">
          <h2 id="h-club">${ic('ball')}観たいクラブ（複数選べます）</h2>
          <div class="field">
            <label for="club-q" class="small">クラブ名・都市名で検索</label>
            <input id="club-q" type="text" placeholder="例：アーセナル、ロンドン、マンチェスター" autocomplete="off" value="${esc(state.clubQ)}">
            <div id="club-sel" class="chips" style="margin-top:10px" aria-live="polite"></div>
            <div id="club-list" class="club-list"></div>
            <div class="err" data-err="clubs"></div>
          </div>
        </section>

        <section class="card form-sec" aria-labelledby="h-where">
          <h2 id="h-where">${ic('plane')}出発地と旅行時期</h2>
          <div class="field"><label for="origin">出発地（日本の主要空港）</label>
            <select id="origin" name="origin">${D.airports.map(a => `<option value="${a.id}" ${i.origin === a.id ? 'selected' : ''}>${esc(a.ja)}</option>`).join('')}</select>
            <div class="err" data-err="origin"></div></div>
          <div class="field"><span class="lbl">時期の決め方</span>
            <div class="seg">${radio('dateMode', 'month', '希望月と旅行日数', '', i.dateMode === 'month')}${radio('dateMode', 'dates', '出発日と帰国日', '', i.dateMode === 'dates')}</div></div>
          <div id="panel-month" ${i.dateMode === 'month' ? '' : 'hidden'}>
            <div class="row">
              <div class="field"><label for="month">希望月</label><input id="month" name="month" type="month" value="${esc(i.month)}" min="${U.todayISO().slice(0, 7)}"><div class="err" data-err="month"></div></div>
              <div class="field"><label for="days">旅行日数（日本発〜日本着）</label><select id="days" name="days">${Array.from({ length: 18 }, (_, k) => k + 4).map(n => `<option value="${n}" ${+i.days === n ? 'selected' : ''}>${n}日間（現地${n - 2}泊）</option>`).join('')}</select><div class="err" data-err="days"></div></div>
            </div>
            <p class="small">希望月の中で、試合に合わせて出発日を自動で選びます。</p>
          </div>
          <div id="panel-dates" ${i.dateMode === 'dates' ? '' : 'hidden'}>
            <div class="row">
              <div class="field"><label for="depart">出発日（日本を出発する日）</label><input id="depart" name="depart" type="date" min="${tomorrow}" value="${esc(i.depart)}"><div class="err" data-err="depart"></div></div>
              <div class="field"><label for="ret">帰国日（日本に到着する日）</label><input id="ret" name="ret" type="date" min="${tomorrow}" value="${esc(i.ret)}"><div class="err" data-err="ret"></div></div>
            </div>
            <p class="small">帰国日は「日本に着く日」です。現地を出発するのはその前日になります。</p>
          </div>
        </section>

        <section class="card form-sec" aria-labelledby="h-budget">
          <h2 id="h-budget">${ic('yen')}予算と人数</h2>
          <div class="row">
            <div class="field"><label for="budget">予算（1人あたり・航空券込み）</label>
              <div class="inline-unit"><input id="budget" name="budget" type="number" inputmode="numeric" min="30000" step="10000" value="${esc(i.budget)}"><span>円</span></div>
              <div class="presets" role="group" aria-label="予算の目安">${[300000, 400000, 500000, 600000, 800000].map(v => `<button type="button" data-action="preset" data-v="${v}">${v / 10000}万円</button>`).join('')}</div>
              <div class="err" data-err="budget"></div></div>
            <div class="field"><label for="people">人数</label>
              <select id="people" name="people">${Array.from({ length: 9 }, (_, k) => k + 1).map(n => `<option value="${n}" ${+i.people === n ? 'selected' : ''}>${n}人</option>`).join('')}</select>
              <p class="small" style="margin-top:6px">宿泊は2人1室で計算します。</p><div class="err" data-err="people"></div></div>
          </div>
        </section>

        <section class="card form-sec" aria-labelledby="h-style">
          <h2 id="h-style">${ic('compass')}旅のスタイル</h2>
          <div class="seg cards">
            ${radio('style', 'match', '観戦優先', '試合を軸に、観戦の数・質を重視', i.style === 'match')}
            ${radio('style', 'sightsee', '観光も楽しむ', '試合の合間に観光もたっぷり', i.style === 'sightsee')}
            ${radio('style', 'budget', '費用を抑える', '価格帯の低い試合・安い宿を優先', i.style === 'budget')}
            ${radio('style', 'move', '移動を少なくする', '同じ都市で観戦・宿泊をまとめる', i.style === 'move')}
          </div>
          <div class="field" style="margin-top:18px"><span class="lbl">観光の好み（複数選べます）</span>
            <div class="multi">${D.interests.map(t => `<label><input type="checkbox" name="interest" value="${t.id}" ${i.interests.includes(t.id) ? 'checked' : ''}><span>${ic(t.icon)}${t.ja}</span></label>`).join('')}</div></div>
          <div class="field"><span class="lbl">観戦したい試合数</span>
            <div class="seg">${radio('matchCount', 1, '1試合', '', +i.matchCount === 1)}${radio('matchCount', 2, '2試合', '', +i.matchCount === 2)}${radio('matchCount', 3, '3試合以上', '', +i.matchCount === 3)}</div>
            <div class="err" data-err="matchCount"></div></div>
        </section>

        <section class="form-sec">
          <details class="manual" id="manual-details" ${i.manual.length ? 'open' : ''}>
            <summary>${ic('ticket')}観たい試合が決まっている方：試合を手入力する</summary>
            <p class="small">対戦カード・開催日・会場を入力すると、その試合を優先して旅程に組み込みます。入力した日程は公式発表と一致するか、ご自身でも確認してください。</p>
            <div id="manual-list"></div>
            <button type="button" class="btn btn-ghost btn-sm" data-action="add-manual" style="margin:8px 0 16px">${ic('plus')}試合を追加</button>
          </details>
        </section>

        <div class="form-actions">
          <button class="btn btn-primary btn-lg" type="submit">${ic('search')}プランを作る</button>
          <button class="btn btn-ghost" type="button" data-action="reset">入力をリセット</button>
        </div>
      </form>
    </div></div>`;
    renderClubPicker(); renderManual();
  }

  function renderClubPicker() {
    const sel = $('#club-sel'), list = $('#club-list'); if (!sel) return;
    const q = state.clubQ.trim().toLowerCase();
    const picked = state.input.clubs;
    sel.innerHTML = picked.length
      ? picked.map(id => `<span class="chip">${esc(D.clubById[id].ja)}<button type="button" data-action="rm-club" data-id="${id}" aria-label="${esc(D.clubById[id].ja)}を外す">${ic('x')}</button></span>`).join('')
      : '<span class="small">まだ選ばれていません</span>';
    const match = c => !q || [c.ja, c.en, cityJa(c.city), c.stadium].some(s => s.toLowerCase().includes(q));
    const items = D.clubs.filter(match);
    list.innerHTML = items.length
      ? items.map(c => `<button type="button" class="chipbtn" aria-pressed="${picked.includes(c.id)}" data-action="toggle-club" data-id="${c.id}"><span class="box">${ic('check')}</span><span>${esc(c.ja)}<small>${esc(cityJa(c.city))}・${esc(c.stadium)}</small></span></button>`).join('')
      : '<p class="small">該当するクラブがありません。別のキーワードをお試しください。</p>';
  }

  function renderManual() {
    const box = $('#manual-list'); if (!box) return;
    box.innerHTML = state.input.manual.map((m, k) => `
      <div class="mrow" data-row="${k}">
        <div class="row">
          <div class="field"><label for="m-home-${k}">ホームチーム</label>
            <select id="m-home-${k}" data-mi="${k}" data-f="home"><option value="">選んでください</option>${D.clubs.map(c => `<option value="${c.id}" ${m.home === c.id ? 'selected' : ''}>${esc(c.ja)}</option>`).join('')}<option value="_other" ${m.home === '_other' ? 'selected' : ''}>その他（手入力）</option></select>
            ${m.home === '_other' ? `<input type="text" style="margin-top:8px" placeholder="ホームチーム名" data-mi="${k}" data-f="homeName" value="${esc(m.homeName || '')}" aria-label="ホームチーム名">` : ''}</div>
          <div class="field"><label for="m-away-${k}">アウェイチーム（任意）</label><input id="m-away-${k}" type="text" list="club-names" data-mi="${k}" data-f="awayName" value="${esc(m.awayName || '')}" placeholder="例：ブライトン"></div>
        </div>
        <div class="row">
          <div class="field"><label for="m-date-${k}">開催日（現地）</label><input id="m-date-${k}" type="date" data-mi="${k}" data-f="date" value="${esc(m.date || '')}" min="${U.addDays(U.todayISO(), 1)}"></div>
          <div class="field"><label for="m-time-${k}">キックオフ時刻（現地・分かれば）</label><input id="m-time-${k}" type="time" data-mi="${k}" data-f="time" value="${esc(m.time || '')}"></div>
        </div>
        <div class="row">
          <div class="field"><label for="m-venue-${k}">会場（任意）</label><input id="m-venue-${k}" type="text" data-mi="${k}" data-f="venue" value="${esc(m.venue || '')}" placeholder="${m.home && D.clubById[m.home] ? esc(D.clubById[m.home].stadium) : 'スタジアム名'}"></div>
          <div class="field"><label for="m-city-${k}">開催都市</label><select id="m-city-${k}" data-mi="${k}" data-f="city"><option value="">選んでください</option>${Object.keys(D.cities).map(id => `<option value="${id}" ${m.city === id ? 'selected' : ''}>${cityJa(id)}</option>`).join('')}</select></div>
        </div>
        <div class="err" data-err="manual-${k}"></div>
        <button type="button" class="btn btn-danger btn-sm" data-action="rm-manual" data-i="${k}">${ic('trash')}この試合を削除</button>
      </div>`).join('') + `<datalist id="club-names">${D.clubs.map(c => `<option value="${esc(c.ja)}">`).join('')}</datalist>`;
  }

  function showErrors(errs) {
    $$('.err').forEach(e => { e.textContent = ''; e.classList.remove('show'); });
    $$('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
    const keys = Object.keys(errs);
    $('#err-summary').classList.toggle('show', keys.length > 0);
    keys.forEach(k => { const el = $(`[data-err="${k}"]`); if (el) { el.textContent = errs[k]; el.classList.add('show'); } });
    const fieldFor = k => {
      if (k === 'clubs') return $('#club-q');
      if (k.startsWith('manual-')) { const n = k.slice(7); return $(`[data-mi="${n}"][data-f="date"]`) || $(`[data-mi="${n}"][data-f="home"]`); }
      return $(`[name="${k}"]`);
    };
    keys.forEach(k => { const f = fieldFor(k); if (f) f.setAttribute('aria-invalid', 'true'); });
    if (keys.length) { const f = fieldFor(keys[0]); if (f) { f.scrollIntoView({ block: 'center' }); f.focus({ preventScroll: true }); } }
  }

  function syncField(t) {
    const i = state.input;
    if (t.dataset.mi !== undefined) {
      const m = i.manual[+t.dataset.mi]; if (!m) return;
      m[t.dataset.f] = t.value;
      if (t.dataset.f === 'home') {
        const c = D.clubById[t.value]; if (c) m.city = c.city;
        renderManual();
      }
      saveInput(); return;
    }
    const n = t.name;
    if (n === 'interest') i.interests = $$('input[name=interest]:checked').map(x => x.value);
    else if (n === 'dateMode') { i.dateMode = t.value; $('#panel-month').hidden = t.value !== 'month'; $('#panel-dates').hidden = t.value !== 'dates'; }
    else if (n === 'matchCount' || n === 'people' || n === 'days') i[n] = +t.value;
    else if (n === 'budget') i.budget = t.value === '' ? '' : +t.value;
    else if (n) i[n] = t.value;
    saveInput();
  }

  // ---------- プラン作成の実行 ----------
  async function runPlan(goto) {
    state.loading = true; state.loadError = null; state.result = null;
    if (goto && location.hash !== '#/results') location.hash = '#/results'; else viewResults();
    try {
      const src = await FT.fixtureSource.load();
      const res = P.generate(JSON.parse(JSON.stringify(state.input)), src.fixtures, src.meta);
      state.result = res;
    } catch (e) {
      console.error(e); state.loadError = '試合データの読み込みまたはプランの作成に失敗しました。';
    }
    state.loading = false;
    if (location.hash.startsWith('#/results')) viewResults();
  }

  // ---------- 3. 結果 ----------
  function viewResults(params) {
    if (params && params.get('sample')) { state.input = sampleInput(); saveInput(); state.result = null; state.loading = false; history.replaceState(null, '', '#/results'); }
    if (state.loading) {
      app.innerHTML = `<div class="page"><div class="container loading" role="status" aria-live="polite"><div class="spinner"></div><h2>プランを作っています…</h2><p class="muted">試合日程と旅程の組み合わせを確認中です。</p></div></div>`; return;
    }
    if (state.loadError) {
      app.innerHTML = `<div class="page"><div class="container">${notice('err', esc(state.loadError))}<p><button class="btn btn-primary" data-action="retry">もう一度試す</button> <a class="btn btn-ghost" href="#/plan">条件を見直す</a></p></div></div>`; return;
    }
    if (!state.result) {
      if (P.validate(state.input).clubs && !state.input.manual.length || Object.keys(P.validate(state.input)).length) { location.replace('#/plan'); return; }
      runPlan(false); return;
    }
    const r = state.result, inp = r.input || state.input;
    if (r.status === 'error') { location.replace('#/plan'); return; }
    const head = `
      <h1>旅行プランの比較</h1>
      <div class="summary-bar">${summaryChips(inp)}</div>
      <p class="toolbar" style="margin:10px 0"><a class="btn btn-ghost btn-sm" href="#/plan">${ic('refresh')}条件を変更して再作成</a></p>
      ${demoMeta(r.meta) ? notice('warn', '<b>デモ：架空の日程・概算料金</b>　表示される試合日程は実在の日程ではありません。料金はすべて概算です。実際の日程・料金・販売状況は必ず公式情報で確認してください。') : notice('info', sourceLine(r.meta))}
      ${notice('info', scopeNote)}
      ${(r.notices || []).map(n => notice(n.level, esc(n.text))).join('')}`;
    if (r.status === 'nomatch') {
      app.innerHTML = `<div class="page"><div class="container">${head}
        <div class="card" style="margin-top:16px"><h2>${ic('alert')} 希望に合う試合が確認できませんでした</h2>
          ${(r.reasons || []).map(t => `<p>${esc(t)}</p>`).join('')}
          ${r.alternatives && r.alternatives.length ? `<h3>こんな条件ならどうですか？</h3>${altCards(r.alternatives)}` : ''}
          <p class="small">観たい試合が決まっている場合は、条件入力画面の「試合を手入力する」から日程を入れて作ることもできます。</p>
        </div></div></div>`; return;
    }
    const plans = r.plans;
    app.innerHTML = `<div class="page"><div class="container">${head}
      <div class="plans">${plans.map(planCard).join('')}</div>
      ${r.alternatives && r.alternatives.length ? `<section class="dsec"><h2>${ic('refresh')}条件を変えた代替案</h2>${altCards(r.alternatives)}</section>` : ''}
      <section class="dsec"><h2>${ic('yen')}3案の比較</h2>${compareTable(plans)}
        <p class="small" style="margin-top:8px">金額は1人あたりの<b>概算</b>です（確定価格ではありません）。海外旅行保険・英国入国手続きの費用・通信費・お土産は含みません。</p></section>
    </div></div>`;
  }

  function summaryChips(inp) {
    const tags = [];
    tags.push(inp.clubs.length ? inp.clubs.map(id => D.clubById[id].ja).join('・') : '手入力の試合');
    tags.push(D.airportById[inp.origin].ja.replace(/（.*/, '') + '発');
    tags.push(inp.dateMode === 'month' ? `${inp.month.replace('-', '年')}月・${inp.days}日間` : `${U.fmtDate(inp.depart)}〜${U.fmtDate(inp.ret)}`);
    tags.push(`1人 ${yen(inp.budget)}`); tags.push(`${inp.people}人`);
    tags.push({ match: '観戦優先', sightsee: '観光も楽しむ', budget: '費用を抑える', move: '移動を少なく' }[inp.style]);
    tags.push(`${inp.matchCount === 3 ? '3試合以上' : inp.matchCount + '試合'}`);
    return tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');
  }

  function planCard(p) {
    const saved = getSaved().some(s => s.id === p.id);
    return `<article class="plan-card p-${p.type}" aria-labelledby="h-${p.id}">
      <header><div class="no">プラン ${p.no}</div><h3 id="h-${p.id}">${esc(p.name)}</h3></header>
      <div class="plan-body">
        <div><div class="total"><small>1人あたりの総額（概算）</small>${yen(p.perPerson)}</div>
          <span class="diff ${p.withinBudget ? 'ok' : 'ng'}">${p.withinBudget ? `予算内（あと ${yen(p.diff)}）` : `予算オーバー（${yen(-p.diff)} 超過）`}</span></div>
        ${costBar(p.costs)}
        <ul class="facts">
          <li>${ic('calendar')}<span>${U.fmtDate(p.depart)}〜${U.fmtDate(p.ret)}（${U.diffDays(p.depart, p.ret) + 1}日間・現地${p.nights}泊）</span></li>
          <li>${ic('bed')}<span>宿泊：${p.cities.map(cityJa).join('・')}</span></li>
          <li>${ic('ball')}<span>観戦：${p.matches.map(m => `${esc(m.homeName)} ${U.fmtDate(m.date)}`).join('<br>')}</span></li>
          <li>${ic('pin')}<span>観光スポット ${p.spots.length}か所</span></li>
        </ul>
        <div class="plan-actions">
          <a class="btn btn-primary btn-sm" href="#/detail/${encodeURIComponent(p.id)}">詳細を見る</a>
          <button class="btn btn-ghost btn-sm ${saved ? 'saved' : ''}" data-action="save" data-id="${p.id}" type="button" aria-pressed="${saved}">${ic('heart')}${saved ? '保存済み' : '保存する'}</button>
        </div>
      </div></article>`;
  }

  function compareTable(plans) {
    const row = (label, f, cls) => `<tr><th scope="row">${label}</th>${plans.map(p => `<td class="${cls || ''}">${f(p)}</td>`).join('')}</tr>`;
    return `<div class="tablewrap"><table class="t"><thead><tr><th></th>${plans.map(p => `<th>${p.no} ${esc(p.name)}</th>`).join('')}</tr></thead><tbody>
      ${row('総額（1人・概算）', p => `<b>${yen(p.perPerson)}</b>`, 'n')}
      ${row('予算との差額', p => p.withinBudget ? `+${yen(p.diff)}` : `−${yen(-p.diff)}（超過）`, 'n')}
      ${row('観戦', p => `${p.matches.length}試合`)}
      ${row('宿泊都市', p => p.cities.map(cityJa).join('・'))}
      ${row('航空券', p => yen(p.costs.flight), 'n')}${row('宿泊', p => yen(p.costs.hotel), 'n')}${row('チケット', p => yen(p.costs.ticket), 'n')}
      ${row('現地交通', p => yen(p.costs.transport), 'n')}${row('食費', p => yen(p.costs.food), 'n')}${row('観光入場料', p => yen(p.costs.sights), 'n')}
    </tbody></table></div>`;
  }

  function altCards(alts) {
    return `<div class="alts">${alts.map((a, k) => `<div class="alt-card"><h4>${esc(a.title)}</h4><p class="small" style="margin:0">${esc(a.text)}</p>
      ${a.summary ? `<p style="margin:0"><b>${yen(a.summary.total)}</b>〜／最大${a.summary.matches}試合 ${a.summary.within ? '<span class="badge ok">予算内</span>' : '<span class="badge check">まだ予算超過</span>'}</p>` : ''}
      <button class="btn btn-ghost btn-sm" type="button" data-action="apply-alt" data-i="${k}">この条件で作り直す</button></div>`).join('')}</div>`;
  }

  // ---------- 4. プラン詳細 ----------
  function findPlan(id) {
    if (state.result && state.result.plans) { const p = state.result.plans.find(x => x.id === id); if (p) return { plan: p, meta: state.result.meta, input: state.result.input }; }
    const s = getSaved().find(x => x.id === id);
    return s ? { plan: s.plan, meta: s.meta, input: s.input, savedAt: s.savedAt } : null;
  }
  const evIcon = { flight: 'plane', transfer: 'train', match: 'ball', sight: 'pin', food: 'fork', hotel: 'bed', warn: 'alert' };
  const kindLabel = { flight: '移動日', match: '試合日', sight: '観光', travel: '移動＋観光', home: '帰国日' };

  function viewDetail(id) {
    const f = findPlan(id);
    if (!f) { app.innerHTML = `<div class="page"><div class="container"><div class="empty">${ic('alert')}<h2>プランが見つかりません</h2><p>ページを再読み込みした場合は、もう一度プランを作成してください。</p><a class="btn btn-primary" href="#/plan">プランを作る</a></div></div></div>`; return; }
    const p = f.plan, meta = f.meta, saved = getSaved().some(s => s.id === p.id);
    document.title = `FOOTBALL TRIP 旅程｜${p.name}｜${p.depart}`;
    const demo = demoMeta(meta);
    const days = U.diffDays(p.depart, p.ret) + 1;
    const keys = [['flight', '航空券', '往復・エコノミーの概算'], ['hotel', '宿泊', `${p.nights}泊・2人1室で計算`], ['ticket', 'チケット', `${p.matches.length}試合分の概算（公式価格ではありません）`], ['transport', '現地交通', '空港移動・都市間鉄道・市内交通'], ['food', '食費', '1日あたりの目安×日数'], ['sights', '観光入場料', '旅程に入れたスポットの合計']];
    app.innerHTML = `<div class="page"><div class="container">
      <p class="toolbar no-print" style="margin-top:0"><a class="btn btn-ghost btn-sm" href="${state.result && state.result.plans && state.result.plans.some(x => x.id === p.id) ? '#/results' : '#/saved'}">← 戻る</a></p>
      <div class="detail-hero">
        <div class="small" style="color:#d6e3f5">プラン ${p.no}</div>
        <h1>${esc(p.name)}</h1>
        <div class="meta"><span>${ic('calendar')}${U.fmtDate(p.depart)}〜${U.fmtDate(p.ret)}（${days}日間・現地${p.nights}泊）</span><span>${ic('bed')}${p.cities.map(cityJa).join('・')}</span><span>${ic('ball')}${p.matches.length}試合</span><span>${ic('users')}${p.people}人</span></div>
        <p style="margin:14px 0 0"><span class="badge ${demo ? 'demo' : 'ok'}">${demo ? 'デモ：架空の日程・概算料金' : '情報源あり'}</span></p>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary btn-sm ${saved ? 'saved' : ''}" data-action="save" data-id="${p.id}" type="button" aria-pressed="${saved}">${ic('heart')}${saved ? '保存済み（押すと削除）' : 'お気に入りに保存'}</button>
        <button class="btn btn-ghost btn-sm" data-action="print" type="button">${ic('printer')}印刷／PDF保存</button>
        <a class="btn btn-ghost btn-sm" href="#/plan">${ic('refresh')}条件を変更して再作成</a>
      </div>
      <div class="print-only"><p class="small">FOOTBALL TRIP 旅程／作成日：${new Date().toLocaleDateString('ja-JP')}／${demo ? 'デモ：架空の日程・概算料金（実際の日程・料金ではありません）' : ''}</p></div>
      ${demo ? notice('warn', '<b>デモ：架空の日程・概算料金。</b>この旅程の試合日程は実在の日程ではありません。予約前に必ず公式サイトで確認してください。') : ''}

      <section class="dsec"><h2>${ic('compass')}旅行の概要</h2>
        <div class="card"><p>${p.matches.length}試合の観戦と観光を組み合わせた、${days}日間（現地${p.nights}泊）のプランです。日本発着・${p.flightInfo.conn ? '乗継便' : '直行便'}を想定しています（運航状況は要確認）。</p>
        <h3>このプランのおすすめポイント</h3><ul>${p.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div></section>

      <section class="dsec"><h2>${ic('ball')}観戦候補の試合</h2>
        <p class="small">対象はプレミアリーグのリーグ戦のみ。${sourceLine(meta)}</p>
        ${p.matches.map(m => matchCard(m, demo)).join('')}
        <details class="faq" style="margin-top:12px"><summary>チケットの種類（一般販売・会員向け・公式ホスピタリティ）</summary><div style="padding-bottom:14px">${ticketExplainer()}</div></details>
      </section>

      <section class="dsec"><h2>${ic('calendar')}日ごとの旅程</h2>
        ${notice('warn', '<b>試合日時は変更されることがあります。</b>テレビ放送などの都合で、日程や時刻が直前に変わる場合があります。航空券・ホテルは変更条件を確認してから予約し、出発直前にも公式日程を再確認してください。')}
        <div class="timeline">${p.days.map(dayCard).join('')}</div></section>

      <section class="dsec"><h2>${ic('train')}移動手段と所要時間の目安</h2>
        <div class="tablewrap"><table class="t"><thead><tr><th>日付</th><th>区間</th><th>手段</th><th>所要</th><th class="n">費用(概算)</th></tr></thead><tbody>
        ${p.transport.map(t => `<tr><td>${U.fmtDate(t.date)}</td><td>${esc(t.from)} → ${esc(t.to)}</td><td>${esc(t.mode)}</td><td>${esc(t.duration)}<br><span class="badge est">${esc(t.note || '概算')}</span></td><td class="n">${t.cost ? yen(t.cost) : '—'}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="small">所要時間・費用は距離からの概算で、実際の時刻表・運賃とは異なります。</p></section>

      <section class="dsec"><h2>${ic('bed')}宿泊する都市とおすすめエリア</h2>
        <div class="grid2">${p.lodging.map(l => `<div class="mini"><h4>${esc(cityJa(l.city))}　${l.nights}泊</h4><p class="small" style="color:inherit">${U.fmtDate(l.from)}〜${U.fmtDate(U.addDays(l.to, 1))}チェックアウト</p><p style="margin:4px 0">おすすめエリア：${esc(l.area)}</p><span class="badge est">目安 1人1泊 約${yen(l.rate)}</span></div>`).join('')}</div></section>

      <section class="dsec"><h2>${ic('pin')}観光スポットと食事の候補</h2>
        <div class="grid2"><div class="mini"><h4>観光スポット</h4><ul style="margin:6px 0 0;padding-left:1.2em">${p.spots.length ? p.spots.map(s => `<li>${esc(s.name)}<span class="small">（${esc(cityJa(s.city))}・${esc(s.area)}）</span></li>`).join('') : '<li>旅程に観光スポットは入っていません</li>'}</ul></div>
        <div class="mini"><h4>食事の候補</h4><ul style="margin:6px 0 0;padding-left:1.2em">${p.foods.map(s => `<li>${esc(s.name)}<span class="small">（${esc(cityJa(s.city))}）</span></li>`).join('')}</ul><p class="small">店名ではなく料理・エリアの候補です。</p></div></div></section>

      <section class="dsec"><h2>${ic('yen')}費用の概算内訳と予算との差額</h2>
        <div class="tablewrap"><table class="t"><thead><tr><th>項目</th><th class="n">1人あたり</th><th>区分・内容</th></tr></thead><tbody>
          ${keys.map(([k, n, d]) => `<tr><td>${n}</td><td class="n">${yen(p.costs[k])}</td><td><span class="badge est">概算</span> ${esc(d)}</td></tr>`).join('')}
          <tr class="sum"><td>総額の目安（1人）</td><td class="n">${yen(p.perPerson)}</td><td>${p.people}人合計 ${yen(p.groupTotal)}</td></tr>
          <tr><td>予算（1人）</td><td class="n">${yen(p.budget)}</td><td></td></tr>
          <tr class="sum"><td>予算との差額</td><td class="n">${p.withinBudget ? '+' + yen(p.diff) : '−' + yen(-p.diff)}</td><td>${p.withinBudget ? '予算内' : '<b style="color:var(--err)">予算オーバー</b>'}</td></tr>
        </tbody></table></div>
        <p class="small" style="margin-top:8px">確定価格はありません。すべて概算です。海外旅行保険・英国入国手続きの費用・通信費・お土産は含みません。為替や時期で大きく変わります。</p></section>

      <section class="dsec"><h2>${ic('check')}予約前に確認する項目</h2>
        <ul class="check card">${p.checklist.map((c, k) => `<li><input type="checkbox" id="ck-${k}"><label for="ck-${k}">${esc(c)}</label></li>`).join('')}</ul></section>

      <section class="dsec no-print"><h2>${ic('external')}公式サイトで確認する</h2>
        <p>プレミアリーグ公式：<a href="https://www.premierleague.com/" target="_blank" rel="noopener noreferrer">プレミアリーグ公式サイト（試合日程）</a></p></section>
    </div></div>`;
  }

  function matchCard(m, demo) {
    const d = new Date(Date.parse(m.date + 'T00:00:00Z'));
    const club = D.clubById[m.home];
    const sched = m.source === 'manual' ? '<span class="badge user">日程：手入力（要確認）</span>' : demo ? '<span class="badge demo">日程：デモ（架空）</span>' : '<span class="badge ok">日程：確認済み</span>';
    return `<div class="match-card">
      <div class="match-date"><span>${d.getUTCMonth() + 1}月</span><b>${d.getUTCDate()}</b><span>${['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()]}曜</span></div>
      <div><h3>${esc(m.homeName)} vs ${esc(m.awayName)}</h3>
        <div class="small" style="color:inherit">${ic('stadium')}${esc(m.venue)}（${esc(cityJa(m.city))}）　${ic('clock')}${fmtKO(m)}</div>
        <div class="badges">${sched}<span class="badge check">チケット：要確認</span><span class="badge est">チケット概算 ${yen(m.ticketCost)}</span></div>
        <p class="small" style="margin:6px 0 0;color:inherit">${ic('alert')}日時は変更される可能性があります。購入前に公式日程を再確認してください。</p>
        <div class="links no-print">${club ? `<a href="${club.site}" target="_blank" rel="noopener noreferrer">${ic('external')}${esc(club.ja)} 公式サイト（チケット案内を探す）</a>` : ''}<a href="https://www.premierleague.com/" target="_blank" rel="noopener noreferrer">${ic('external')}プレミアリーグ公式（試合日程）</a></div>
      </div></div>`;
  }

  function dayCard(d) {
    return `<article class="tl-day k-${d.kind}"><div class="tl-head"><span class="dno">${d.label}</span><span>${U.fmtDate(d.date)}</span><span class="ttl">${esc(d.title)}</span><span class="badge est">${kindLabel[d.kind] || ''}</span></div>
      <div class="tl-body">${d.events.map(e => `<div class="ev t-${e.kind}"><time>${e.time}</time><span class="dot">${ic(evIcon[e.kind] || 'pin')}</span><div><h4>${esc(e.title)}</h4>${e.detail ? `<p>${esc(e.detail)}</p>` : ''}</div></div>`).join('')}</div>
      ${d.notes.length ? `<div class="tl-notes">${d.notes.map(n => notice('warn', esc(n))).join('')}</div>` : ''}</article>`;
  }

  // ---------- 保存したプラン ----------
  function viewSaved() {
    const list = getSaved();
    app.innerHTML = `<div class="page"><div class="container"><h1>保存したプラン</h1>
      <p class="muted">この端末のブラウザ内に保存されています（他の端末には共有されません）。ブラウザのデータを消すと、保存したプランも消えます。</p>
      ${list.length ? `<div class="saved-grid">${list.map(s => { const p = s.plan; return `<article class="card"><span class="badge ${demoMeta(s.meta) ? 'demo' : 'ok'}">${demoMeta(s.meta) ? 'デモ：架空の日程' : '情報源あり'}</span>
        <h3 style="margin-top:8px">${p.no} ${esc(p.name)}</h3>
        <p class="small" style="color:inherit">${U.fmtDate(p.depart)}〜${U.fmtDate(p.ret)}／${p.cities.map(cityJa).join('・')}<br>${p.matches.map(m => esc(m.homeName)).join('・')}</p>
        <p style="margin:6px 0"><b style="font-size:1.4rem">${yen(p.perPerson)}</b> <span class="small">/人（概算）</span></p>
        <p class="small">保存：${new Date(s.savedAt).toLocaleString('ja-JP')}</p>
        <div class="plan-actions"><a class="btn btn-primary btn-sm" href="#/detail/${encodeURIComponent(s.id)}">詳細を見る</a><button class="btn btn-danger btn-sm" type="button" data-action="delete-saved" data-id="${s.id}">${ic('trash')}削除</button></div></article>`; }).join('')}</div>`
        : `<div class="empty">${ic('bookmark')}<h2>まだ保存したプランはありません</h2><p>プランの「保存する」ボタンで、お気に入りを残せます。</p><a class="btn btn-primary" href="#/plan">プランを作る</a></div>`}
    </div></div>`;
  }

  // ---------- 5. ガイド ----------
  function viewGuide() {
    app.innerHTML = `<div class="page"><div class="container" style="max-width:860px"><h1>初めての海外観戦ガイド</h1>
      <p class="muted">プレミアリーグ観戦の流れを、順番に説明します。${scopeNote}</p>
      <section class="dsec"><h2>${ic('check')}観戦までの5ステップ</h2>
        <ol><li><b>観たい試合の日程を公式で確認</b>：試合日程はクラブ・プレミアリーグの公式サイトで確認します。</li>
        <li><b>チケットの販売方法を確認</b>：一般販売・会員向け・公式ホスピタリティのどれかを確認します（下記）。</li>
        <li><b>航空券・ホテルは変更条件を見て予約</b>：試合日時が変わることがあるため、変更・キャンセルしやすいものが安心です。</li>
        <li><b>入国の準備</b>：パスポートの有効期間や、英国入国に必要な手続きを英国政府の公式情報で確認します。</li>
        <li><b>当日の準備</b>：スタジアムへの行き方、入場ルール（手荷物の制限）を確認します。</li></ol></section>
      <section class="dsec"><h2>${ic('ticket')}チケットの種類</h2>${ticketExplainer()}</section>
      <section class="dsec"><h2>${ic('stadium')}試合当日の流れ</h2>
        <ul><li>キックオフの<b>2時間前</b>を目安にスタジアム周辺へ。グッズ売り場や周辺の雰囲気も楽しめます。</li>
        <li>入場時に手荷物検査があります。大きなバッグは持ち込めないことが多いので、公式のルールを確認しましょう。</li>
        <li>試合後は駅や道路が大混雑します。少し時間をずらすか、事前に帰りの交通手段を決めておくと安心です。</li>
        <li>夜の試合は帰りが遅くなります。最終の電車・バスの時刻を確認しておきましょう。</li></ul></section>
      <section class="dsec"><h2>${ic('clock')}時差と日程変更</h2>
        <ul><li>英国時間は日本より8〜9時間遅れています（夏時間の期間は8時間）。日本時間に直すと深夜〜早朝の試合もあります。</li>
        <li>到着翌日は時差ボケがあります。到着翌日の予定は詰め込みすぎないのがおすすめです。</li>
        <li>試合日時は放送の都合で変更されることがあります。出発直前にも公式で再確認してください。</li></ul></section>
      <section class="dsec faq"><h2>${ic('info')}よくある質問</h2>
        <details><summary>チケットが取れなかったらどうなりますか？</summary><p style="padding-bottom:14px">公式ホスピタリティや、クラブ公式の再販売の仕組みがある場合はそれを確認します。非公式の個人売買は避けてください。日程の別の試合や別のクラブに変えるのも一案です。</p></details>
        <details><summary>このサイトでチケットや旅行を予約できますか？</summary><p style="padding-bottom:14px">できません。プランの検討用です。予約・購入は、公式サイトや各予約サービスでご自身で行ってください。</p></details>
        <details><summary>表示される試合日程は本物ですか？</summary><p style="padding-bottom:14px">現在のデモ版では架空の日程です。「デモ：架空の日程」と表示しています。実際の日程は必ず公式サイトで確認してください。</p></details></section>
      <section class="dsec"><h2>${ic('external')}公式サイト（日程・チケット案内）</h2>
        <p>まずはプレミアリーグ公式で日程を確認し、各クラブ公式サイトでチケットの案内を探してください。</p>
        <p><a href="https://www.premierleague.com/" target="_blank" rel="noopener noreferrer">プレミアリーグ公式サイト</a></p>
        <div class="clubs-row">${D.clubs.map(c => `<a class="tag" href="${c.site}" target="_blank" rel="noopener noreferrer">${esc(c.ja)}</a>`).join('')}</div></section>
      <p style="margin-top:32px"><a class="btn btn-primary btn-lg" href="#/plan">${ic('compass')}観戦旅行を計画する</a></p>
    </div></div>`;
  }

  function viewPrivacy() {
    const an = FT.analytics || { enabled: false };
    app.innerHTML = `<div class="page"><div class="container" style="max-width:820px"><h1>プライバシーと計測について</h1>
      ${an.enabled ? notice('info', 'このサイトでは、同意いただいた場合のみ、アクセス状況の計測を行います。') : notice('info', '現在このサイトはアクセス計測を行っていません（外部への送信はありません）。')}
      <section class="dsec"><h2>${ic('info')}計測する内容と送信先</h2>
        <ul><li><b>Googleアナリティクス4・Googleタグマネージャー</b>（Google）：閲覧したページ名、ボタン操作（例：プラン作成・保存・印刷）、端末やブラウザの種類などの利用状況。</li>
        <li><b>Microsoft Clarity</b>（Microsoft）：画面上のクリックやスクロールの動き。入力欄の内容は画面録画でも隠します。</li>
        <li><b>Googleサーチコンソール</b>：サイト所有者が、検索結果での表示状況を確認するためのものです。訪問者のデータを送るものではありません。</li></ul>
        <p>これらはCookie等を使い、情報が各社のサーバー（海外を含む）に送信されます。広告目的の利用はしません。</p></section>
      <section class="dsec"><h2>${ic('check')}送らない情報</h2>
        <p>条件入力画面で入力した<b>予算・クラブ名・日程・人数・手入力した試合</b>、保存したプランの内容は、外部に送信しません（ご利用の端末の中だけに保存されます）。</p></section>
      <section class="dsec"><h2>${ic('refresh')}同意の変更</h2>
        <p>画面下の「計測の設定を変更」から、いつでも同意を取り消せます。</p></section>
      <p class="small">※ 運営者名・お問い合わせ先などは、公開前に追記してください。</p>
    </div></div>`;
  }

  // ---------- イベント ----------
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const a = b.dataset.action, i = state.input;
    if (a === 'sample') { track('sample_click'); state.input = sampleInput(); saveInput(); runPlan(true); }
    else if (a === 'toggle-club') { const id = b.dataset.id; i.clubs = i.clubs.includes(id) ? i.clubs.filter(x => x !== id) : i.clubs.concat(id); saveInput(); renderClubPicker(); }
    else if (a === 'rm-club') { i.clubs = i.clubs.filter(x => x !== b.dataset.id); saveInput(); renderClubPicker(); }
    else if (a === 'preset') { i.budget = +b.dataset.v; $('#budget').value = i.budget; saveInput(); }
    else if (a === 'add-manual') { if (i.manual.length >= 5) { toast('手入力できる試合は5件までです'); return; } i.manual.push({ home: '', homeName: '', awayName: '', date: '', time: '', venue: '', city: '' }); saveInput(); renderManual(); }
    else if (a === 'rm-manual') { i.manual.splice(+b.dataset.i, 1); saveInput(); renderManual(); }
    else if (a === 'reset') { state.input = defaultInput(); state.clubQ = ''; saveInput(); viewPlan(); }
    else if (a === 'retry') runPlan(false);
    else if (a === 'apply-alt') {
      const alt = state.result.alternatives[+b.dataset.i]; if (!alt) return;
      Object.assign(state.input, alt.patch); saveInput(); track('alt_apply'); runPlan(false);
    }
    else if (a === 'save') {
      const f = findPlan(b.dataset.id); if (!f) return;
      let list = getSaved();
      if (list.some(s => s.id === f.plan.id)) { list = list.filter(s => s.id !== f.plan.id); setSaved(list); toast('保存を取り消しました'); }
      else { list.unshift({ id: f.plan.id, savedAt: new Date().toISOString(), plan: f.plan, input: f.input, meta: f.meta }); if (!setSaved(list)) { toast('保存できませんでした（ブラウザの設定をご確認ください）'); return; } toast('お気に入りに保存しました'); track('plan_save'); }
      const y = window.scrollY; route(true); window.scrollTo(0, y);
    }
    else if (a === 'delete-saved') {
      if (!confirm('このプランを削除しますか？')) return;
      setSaved(getSaved().filter(s => s.id !== b.dataset.id)); toast('削除しました'); track('plan_delete'); viewSaved();
    }
    else if (a === 'print') { track('print'); window.print(); }
  });

  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'club-q') { state.clubQ = t.value; renderClubPicker(); return; }
    if (t.closest('#plan-form') && t.type !== 'radio' && t.type !== 'checkbox' && t.tagName !== 'SELECT') syncField(t);
  });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.closest('#plan-form') && t.id !== 'club-q') syncField(t);
  });
  document.addEventListener('submit', ev => {
    if (ev.target.id !== 'plan-form') return;
    ev.preventDefault();
    const errs = P.validate(state.input);
    showErrors(errs);
    if (Object.keys(errs).length) return;
    saveInput(); track('plan_submit'); runPlan(true);
  });

  window.addEventListener('hashchange', () => route());
  route();
})();
