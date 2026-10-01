/* FOOTBALL TRIP - ルールベースのプラン生成エンジン
   入力条件 + 試合リスト(fixtures) -> 3つのプラン。外部通信なし・純粋な計算のみ。
   将来AIに替える場合は FT.planner.generate と同じ入出力の関数を用意すれば差し替え可能。 */
globalThis.FT = globalThis.FT || {};
(function () {
  const FT = globalThis.FT;
  const D = FT.data;
  const MS = 86400000;

  // ---------- 日付・時刻ユーティリティ ----------
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const addDays = (s, n) => iso(parse(s) + n * MS);
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / MS);
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const fmtDate = s => { const d = new Date(parse(s)); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${WD[d.getUTCDay()]})`; };
  const lastSun = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, d.getUTCDate() - d.getUTCDay()); };
  const isBST = s => { const t = parse(s), y = +s.slice(0, 4); return t >= lastSun(y, 2) && t < lastSun(y, 9); };
  const jstGap = s => (isBST(s) ? 8 : 9); // 日本時間 - 英国時間（時間）
  const hm = m => { m = Math.round(m); const h = Math.floor(m / 60) % 24, mm = ((m % 60) + 60) % 60; return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const todayISO = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
  const round1000 = n => Math.round(n / 1000) * 1000;
  const cityJa = id => (D.cities[id] ? D.cities[id].ja : id);

  const TYPES = {
    saver: { no: '①', name: '費用を抑えるプラン', flight: 0.9, hotel: 0.7, ticket: 0.85, food: 4500, spots: 2 },
    balance: { no: '②', name: '観戦と観光のバランスプラン', flight: 1.0, hotel: 1.0, ticket: 1.0, food: 7200, spots: 3 },
    priority: { no: '③', name: '観戦を優先するプラン', flight: 1.1, hotel: 1.25, ticket: 1.35, food: 8500, spots: 2 },
  };

  // ---------- 入力チェック ----------
  function validate(inp, today) {
    today = today || todayISO();
    const e = {};
    if (!inp.clubs.length && !inp.manual.length) e.clubs = '観たいクラブを1つ以上選ぶか、観たい試合を手入力してください。';
    if (!inp.origin) e.origin = '出発地を選んでください。';
    if (inp.dateMode === 'dates') {
      if (!inp.depart) e.depart = '出発日を入力してください。';
      else if (inp.depart <= today) e.depart = '出発日は明日以降の日付にしてください。';
      if (!inp.ret) e.ret = '日本への到着日（帰国日）を入力してください。';
      if (inp.depart && inp.ret) {
        const n = diffDays(inp.depart, inp.ret) + 1;
        if (n < 1) e.ret = '帰国日は出発日より後の日付にしてください。';
        else if (n < 4) e.ret = '旅行日数が短すぎます。日本到着日まで含めて最低4日間（現地2泊）が必要です。';
        else if (n > 21) e.ret = '旅行日数は21日以内にしてください。';
      }
    } else {
      if (!inp.month) e.month = '希望の月を選んでください。';
      else if (inp.month < today.slice(0, 7)) e.month = '今月以降の月を選んでください。';
      if (!(inp.days >= 4 && inp.days <= 21)) e.days = '旅行日数は4〜21日で指定してください。';
    }
    if (!(inp.budget >= 30000 && inp.budget <= 10000000)) e.budget = '予算は3万円〜1,000万円の範囲で、数字で入力してください。';
    if (!(inp.people >= 1 && inp.people <= 9)) e.people = '人数は1〜9人で指定してください。';
    if (![1, 2, 3].includes(inp.matchCount)) e.matchCount = '観戦したい試合数を選んでください。';
    (inp.manual || []).forEach((m, i) => {
      const msgs = [];
      if (!m.home || (m.home === '_other' && !(m.homeName || '').trim())) msgs.push('ホームチームを選ぶか入力してください');
      if (!m.date || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) msgs.push('開催日を入力してください');
      else if (m.date <= today) msgs.push('開催日は明日以降にしてください');
      if (!m.city) msgs.push('開催都市を選んでください');
      if (msgs.length) e['manual-' + i] = msgs.join('／');
    });
    return e;
  }

  // ---------- 試合の組み合わせ可否 ----------
  function chainOK(a, b) {
    const gap = diffDays(a.date, b.date);
    if (gap < 1) return false;
    if (a.city === b.city) return true;
    const t = D.trainHours(a.city, b.city);
    if (gap === 1) return toMin(b.time) / 60 >= 9 + t + 2.5; // 翌日朝に移動して間に合うか
    return t <= 5.5;
  }
  function startOK(f, dep) {
    const gap = diffDays(dep, f.date);
    if (gap < 1) return false;
    if (f.city === 'london') return true;
    if (gap === 1) return toMin(f.time) / 60 >= 9 + D.trainHours('london', f.city) + 2.5;
    return true;
  }
  function endOK(f, ret) {
    const gap = diffDays(f.date, ret);
    if (gap < 2) return false; // 帰国便は帰国日の前日に現地を出発
    if (f.city === 'london') return true;
    if (gap === 2) return 13 - 3 - 1 - D.trainHours(f.city, 'london') >= 7; // 翌朝7時までに出発できるか
    return true;
  }

  function enumerate(pool, k, win, sameCity, strict) {
    const res = [], chosen = [];
    let guard = 0;
    (function rec(i) {
      if (guard > 4000) return;
      if (chosen.length === k) {
        if (strict && pool.slice(i).some(p => p.req)) return;
        if (endOK(chosen[chosen.length - 1], win.R)) { res.push(chosen.slice()); guard++; }
        return;
      }
      if (i >= pool.length) return;
      const f = pool[i], prev = chosen[chosen.length - 1];
      let ok = prev ? chainOK(prev, f) : startOK(f, win.D);
      if (ok && sameCity && chosen.length && chosen[0].city !== f.city) ok = false;
      if (ok) { chosen.push(f); rec(i + 1); chosen.pop(); }
      if (!(strict && f.req)) rec(i + 1);
    })(0);
    return res;
  }

  function scoreSet(set, type, style) {
    const tier = set.reduce((s, f) => s + f.tier, 0);
    const ticket = set.reduce((s, f) => s + D.TICKET_BASE[f.tier], 0) / 10000;
    let travel = 0, changes = 0, prev = 'london';
    for (const f of set) { if (f.city !== prev) { changes++; travel += D.trainHours(prev, f.city); } prev = f.city; }
    if (prev !== 'london') { changes++; travel += D.trainHours(prev, 'london'); }
    const wMove = style === 'move' ? 3 : 1, wCost = style === 'budget' ? 2 : 1, wMatch = style === 'match' ? 1.5 : 1;
    if (type === 'saver') return -ticket * 2 * wCost - travel * 2 * wMove - changes * 1.5 * wMove;
    if (type === 'balance') return tier * wMatch - ticket * 0.5 * wCost - travel * 1.2 * wMove - changes * wMove;
    return tier * 2.5 * wMatch - travel * 0.5 * wMove;
  }

  // ---------- 夜ごとの宿泊都市 ----------
  function nightCities(win, set) {
    const map = {}, lastNight = addDays(win.R, -2);
    for (let d = win.D; d <= lastNight; d = addDays(d, 1)) {
      let city = 'london';
      if (set.length) {
        let i = -1;
        set.forEach((f, idx) => { if (f.date <= d) i = idx; });
        if (i === -1) {
          const f = set[0];
          if (d === addDays(f.date, -1) && d !== win.D) city = f.city;
        } else if (i === set.length - 1) {
          const f = set[i];
          city = (d === lastNight && d !== f.date) ? 'london' : f.city;
        } else {
          const f = set[i], n = set[i + 1];
          city = (diffDays(f.date, n.date) >= 2 && d === addDays(n.date, -1)) ? n.city : f.city;
        }
      }
      map[d] = city;
    }
    return map;
  }

  // ---------- 日ごとの旅程 ----------
  function buildDays(ctx) {
    const { win, set, nightMap, type, origin, interests, style, people } = ctx;
    const T = TYPES[type];
    const usedSpots = new Set(), usedFood = new Set();
    const days = [], transport = [], spotsOut = [], foodsOut = [];
    let sightCost = 0;
    const lastNight = addDays(win.R, -2);
    const conn = !origin.direct || type === 'saver';
    const durOut = conn ? (type === 'priority' && !origin.direct ? 17.5 : 19) : 14.5;
    const durBack = conn ? 18 : 13.5;
    const clubIdsHere = new Set(ctx.clubIds.concat(set.map(f => f.home).filter(Boolean)));

    const ranked = city => {
      let list = (D.spots[city] || []).slice();
      if (interests.includes('football')) {
        D.clubs.filter(c => c.city === city && clubIdsHere.has(c.id)).forEach(c =>
          list.push({ id: 'tour-' + c.id, name: `${c.ja} スタジアムツアー／クラブ博物館（実施状況は公式で要確認）`, tags: ['football'], cost: 4500, hours: 1.5, area: c.stadium + '周辺' }));
      }
      const sc = s => s.tags.filter(t => interests.includes(t)).length * 3 + (type === 'saver' && s.cost === 0 ? 2 : 0) - s.cost / 5000;
      return list.filter(s => !usedSpots.has(s.id)).sort((a, b) => sc(b) - sc(a));
    };
    const pickFood = city => {
      const list = (D.foods[city] || []).slice();
      const sc = f => f.tags.filter(t => interests.includes(t)).length * 2 + (usedFood.has(city + f.name) ? -9 : 0);
      list.sort((a, b) => sc(b) - sc(a));
      const f = list[0] || { name: '現地のレストラン', cost: 3000 };
      usedFood.add(city + f.name);
      foodsOut.push({ city, name: f.name });
      return f;
    };

    function dayEvents() {
      const ev = [];
      const add = (min, kind, title, detail) => ev.push({ min, time: hm(min), kind, title, detail: detail || '' });
      return { ev, add };
    }

    // 観光ブロック: 時間枠[S,E]に最大n件
    function sightBlock(add, city, S, E, n) {
      let cur = S, lunch = false, placed = 0;
      for (const sp of ranked(city)) {
        if (placed >= n) break;
        if (!lunch && cur >= 11 * 60 + 45 && E > 13 * 60) {
          const f = pickFood(city); add(cur, 'food', '昼食', `候補：${f.name}`); cur += 70; lunch = true;
        }
        const dur = Math.round(sp.hours * 60);
        if (cur + dur > E) continue;
        usedSpots.add(sp.id);
        add(cur, 'sight', sp.name, `${sp.area}／所要 約${sp.hours}時間／入場料の目安 ${sp.cost ? '約' + sp.cost.toLocaleString() + '円' : '無料（要確認）'}`);
        sightCost += sp.cost; spotsOut.push({ city, ...sp });
        cur += dur + 30; placed++;
      }
      if (placed === 0 && E - S >= 90) add(S, 'sight', '自由時間（街歩き・カフェ休憩）', `${cityJa(city)}の街をのんびり散策`);
      if (!lunch && E > 13 * 60) {
        const at = Math.max(cur, 12 * 60), f = pickFood(city);
        if (at < E) { add(at, 'food', '昼食', `候補：${f.name}`); cur = at + 70; }
      }
      return cur;
    }

    for (let d = win.D, idx = 1; d <= win.R; d = addDays(d, 1), idx++) {
      const { ev, add } = dayEvents();
      const day = { date: d, label: `Day ${idx}`, events: ev, kind: 'sight', city: nightMap[d] || null, title: '', notes: [] };
      const gap = jstGap(d);

      if (d === win.D) {
        // ---- 出発日 ----
        const depMin = conn ? 8 * 60 : 11 * 60;
        const arrive = depMin + durOut * 60 - gap * 60; // 現地到着時刻(分)
        day.kind = 'flight'; day.title = '日本を出発 → ロンドン到着';
        add(depMin - 180, 'transfer', `${origin.ja}に到着`, '搭乗手続き・手荷物預け・保安検査（出発の3時間前が目安）');
        add(depMin, 'flight', `日本を出発（日本時間 ${hm(depMin)}）`, conn ? '乗継便を想定（合計の所要 約' + durOut + '時間）。直行便・乗継便は時期や航空会社で変わるため要確認' : '直行便を想定（所要 約14時間30分）。運航の有無は時期・航空会社で要確認');
        add(arrive, 'flight', `ロンドン・ヒースロー空港に到着（現地時間 ${hm(arrive)}）`, `日本との時差：日本が現地より${gap}時間進んでいます（日本時間では翌日の ${hm(arrive + gap * 60)}）`);
        add(arrive + 60, 'transfer', '入国審査・荷物受取・空港から市内へ', 'ヒースロー空港から中心部まで鉄道・地下鉄で約1時間（概算）。入国審査は混雑で前後します');
        if (arrive + 150 <= 22 * 60 + 30) {
          add(arrive + 150, 'hotel', 'ホテルにチェックイン', `${cityJa('london')}泊。おすすめエリア：${D.cities.london.area}`);
          if (arrive + 210 <= 21 * 60 + 30) { const f = pickFood('london'); add(arrive + 210, 'food', '夕食（軽め）', `候補：${f.name}。長旅の疲れと時差ボケのため早めに休みます`); }
        } else {
          add(arrive + 150, 'warn', '到着が遅い日程です', 'ホテルへ直行して休みましょう。夕食は機内食・ホテル周辺で簡単に済ませる想定です');
        }
        transport.push({ date: d, from: origin.ja, to: 'ロンドン（ヒースロー空港）', mode: conn ? '飛行機（乗継）' : '飛行機（直行想定）', duration: `約${durOut}時間`, note: '概算' });
        transport.push({ date: d, from: 'ヒースロー空港', to: 'ロンドン市内のホテル', mode: '鉄道／地下鉄', duration: '約1時間', note: '概算' });
      } else if (d === win.R) {
        // ---- 帰国日（日本到着日）----
        const gapB = jstGap(addDays(d, -1));
        const arrJst = 13 * 60 + gapB * 60 + durBack * 60 - 1440;
        day.kind = 'home'; day.city = null; day.title = '帰国日：日本に到着';
        add(arrJst, 'flight', `日本に到着（日本時間 ${hm(arrJst)}）`, `前日に現地を出発した便が到着します。${conn ? '乗継便のため所要は約' + durBack + '時間' : '所要 約13時間30分'}（概算）`);
        add(arrJst + 60, 'transfer', '入国・荷物受取・帰宅', origin.direct ? '到着空港から自宅へ' : `${origin.ja}に到着後、ご自宅へ（乗継の都合で到着空港や時刻が変わる場合があります）`);
        day.notes.push('帰国日は「日本に到着する日」です。現地を出発するのは前日になります。翌日の仕事・予定には余裕を持たせてください。');
      } else if (d === addDays(win.R, -1)) {
        // ---- 現地出発日 ----
        const dep = 13 * 60, airport = dep - 180, last = nightMap[lastNight];
        let leave = airport - 60;
        day.kind = 'flight'; day.title = '現地を出発（機内泊）';
        if (last !== 'london') {
          const t = D.trainHours(last, 'london');
          leave -= Math.round(t * 60);
          add(leave, 'transfer', `${cityJa(last)}を出発 → ロンドンへ`, `鉄道で約${t}時間（概算）。チェックアウトを済ませて出発`);
          transport.push({ date: d, from: cityJa(last), to: 'ロンドン', mode: '鉄道', duration: `約${t}時間`, cost: D.trainCost(last, 'london'), note: '概算' });
        } else if (leave >= 9 * 60) {
          add(8 * 60, 'hotel', '朝食・荷造り・チェックアウト', 'お土産の買い足しは前日までに済ませると安心です');
        }
        add(last !== 'london' ? leave + Math.round(D.trainHours(last, 'london') * 60) : leave, 'transfer', 'ロンドン市内 → ヒースロー空港', '鉄道・地下鉄で約1時間（概算）');
        add(airport, 'transfer', 'ヒースロー空港に到着（出発の3時間前）', '搭乗手続き・免税手続き・保安検査');
        add(dep, 'flight', `ロンドンを出発（現地時間 ${hm(dep)}）`, '機内で1泊。日本到着は翌日（帰国日）です');
        transport.push({ date: d, from: 'ロンドン市内のホテル', to: 'ヒースロー空港', mode: '鉄道／地下鉄', duration: '約1時間', note: '概算' });
        transport.push({ date: d, from: 'ロンドン（ヒースロー空港）', to: origin.ja, mode: conn ? '飛行機（乗継）' : '飛行機（直行想定）', duration: `約${durBack}時間`, note: '概算' });
      } else {
        // ---- 現地の通常日 ----
        const city = nightMap[d], prev = nightMap[addDays(d, -1)];
        const m = set.find(f => f.date === d);
        let cur = d === addDays(win.D, 1) ? 10 * 60 : 9 * 60 + 30;
        if (d === addDays(win.D, 1)) day.notes.push('到着翌日は時差ボケがあります。午前はゆっくり、予定は少なめにしています。');
        if (prev !== city) {
          const t = D.trainHours(prev, city);
          add(9 * 60 + 30, 'transfer', `${cityJa(prev)} → ${cityJa(city)}へ移動`, `鉄道で約${t}時間（概算）。荷物はホテルに預けられるか確認`);
          cur = 9 * 60 + 30 + Math.round(t * 60) + 30;
          add(cur - 30, 'hotel', `${cityJa(city)}に到着`, `おすすめエリア：${D.cities[city].area}`);
          transport.push({ date: d, from: cityJa(prev), to: cityJa(city), mode: '鉄道', duration: `約${t}時間`, cost: D.trainCost(prev, city), note: '概算' });
        }
        if (m) {
          const KO = toMin(m.time), arr = KO - 120, leaveH = arr - m.stadiumMin, endM = KO + 115, back = endM + 30;
          day.kind = 'match'; day.title = `試合日：${m.homeName} vs ${m.awayName}`;
          const nS = Math.max(0, Math.min(T.spots - (style === 'match' ? 1 : 0) + (style === 'sightsee' ? 1 : 0), Math.floor((leaveH - 30 - cur) / 150)));
          if (nS > 0) sightBlock(add, city, cur, leaveH - 30, nS);
          else if (leaveH - cur >= 90) { const f = pickFood(city); add(cur, 'food', '朝食・ホテル周辺で軽く散策', `候補：${f.name}`); }
          add(leaveH, 'transfer', 'スタジアムへ出発', `宿泊エリアから約${m.stadiumMin}分（目安）。電車・バスの混雑を見込んで余裕を持って出発`);
          add(arr, 'match', 'スタジアム周辺に到着（キックオフの2時間前が目安）', '周辺散策・グッズ・軽食。入場時の手荷物検査は混雑するため早めの入場がおすすめ');
          add(KO, 'match', `キックオフ（現地時間 ${m.time}${m.timeAssumed ? '・時刻未入力のため仮定' : ''}）`, `${m.homeName} vs ${m.awayName}／${m.venue}`);
          add(endM, 'match', '試合終了（目安）', '終了直後は駅や道路が大混雑。少し待ってから帰ると安心です');
          add(back, 'transfer', 'ホテルへ戻る', `約${m.stadiumMin}分（目安）`);
          const home = back + m.stadiumMin;
          if (home <= 21 * 60 + 30) { const f = pickFood(city); add(home + 15, 'food', '夕食', `候補：${f.name}`); }
          else add(home, 'warn', '帰りが遅くなります', '最終電車・バスの時刻を事前に確認し、移動手段に迷う場合は配車アプリの利用も検討してください');
          day.notes.push('試合の日時はテレビ放送などの都合で変更されることがあります。航空券・ホテルは変更条件を確認してから予約し、出発直前にも公式日程を再確認してください。');
          transport.push({ date: d, from: `${cityJa(city)}の宿泊エリア`, to: m.venue, mode: '電車・バス・徒歩', duration: `約${m.stadiumMin}分`, note: '目安' });
        } else {
          day.kind = prev !== city ? 'travel' : 'sight'; day.title = `${cityJa(city)}を楽しむ日`;
          if (prev !== city) day.title = `${cityJa(prev)} → ${cityJa(city)}へ移動・観光`;
          const E = d === addDays(win.D, 1) ? 17 * 60 + 30 : 18 * 60;
          const n = Math.max(1, T.spots + (style === 'sightsee' ? 1 : 0) - (style === 'match' ? 1 : 0) - (d === addDays(win.D, 1) ? 1 : 0));
          sightBlock(add, city, cur, E, Math.min(n, 4));
          const f = pickFood(city); add(19 * 60, 'food', '夕食', `候補：${f.name}`);
        }
      }
      ev.sort((a, b) => a.min - b.min);
      days.push(day);
    }
    return { days, transport, sightCost, spots: spotsOut, foods: foodsOut, conn, durOut, durBack };
  }

  // ---------- 1プランの組み立て ----------
  function makePlan(type, win, set, inp, meta, idBase) {
    const T = TYPES[type];
    const origin = D.airportById[inp.origin];
    const nightMap = nightCities(win, set);
    const nights = Object.keys(nightMap).length;
    const built = buildDays({ win, set, nightMap, type, origin, interests: inp.interests, style: inp.style, people: inp.people, clubIds: inp.clubs });

    // 費用（1人あたり・概算）
    const month = +win.D.slice(5, 7);
    const flight = 200000 * origin.mult * D.season[month] * T.flight * (built.conn && type !== 'saver' ? 0.95 : 1);
    const rooms = Math.ceil(inp.people / 2);
    let hotel = 0;
    Object.values(nightMap).forEach(c => { hotel += D.cities[c].hotelRate * T.hotel * rooms / inp.people; });
    const ticket = set.reduce((s, f) => s + D.TICKET_BASE[f.tier] * T.ticket, 0);
    const legs = built.transport.filter(t => t.cost).reduce((s, t) => s + t.cost, 0);
    const transport = 5600 + legs + 1800 * (nights);
    const foodMult = inp.interests.includes('gourmet') ? 1.12 : 1;
    const food = T.food * foodMult * (nights + 1);
    const sights = built.sightCost;
    const costs = { flight: round1000(flight), hotel: round1000(hotel), ticket: round1000(ticket), transport: round1000(transport), food: round1000(food), sights: round1000(sights) };
    const perPerson = costs.flight + costs.hotel + costs.ticket + costs.transport + costs.food + costs.sights;
    const diff = inp.budget - perPerson;

    // 宿泊リスト（連続する同一都市をまとめる）
    const lodging = [];
    Object.keys(nightMap).sort().forEach(d => {
      const c = nightMap[d], last = lodging[lodging.length - 1];
      if (last && last.city === c) { last.nights++; last.to = d; } else lodging.push({ city: c, nights: 1, from: d, to: d, area: D.cities[c].area });
    });
    lodging.forEach(l => { l.rate = round1000(D.cities[l.city].hotelRate * T.hotel * rooms / inp.people); });

    const cities = [...new Set(lodging.map(l => l.city))];
    const matchesOut = set.map(f => {
      const club = D.clubById[f.home];
      return { ...f, officialSite: club ? club.site : null, ticketCost: round1000(D.TICKET_BASE[f.tier] * T.ticket) };
    });

    const stadiumCities = set.length ? cityJa(set[0].city) : '';
    const highlights = {
      saver: ['航空券は乗継便を想定し、運賃を抑えた構成です。', '宿泊は価格を抑えた宿を想定（中心部から少し離れたエリアも選択肢）。', 'チケットは価格帯が低めの席から検討する前提です。', '観光は無料で楽しめるスポットを優先しています。'],
      balance: ['観戦と観光のどちらも無理なく楽しめる配分です。', '中心部のホテルを想定し、移動の負担を減らしています。', '観光は1日あたり2〜3か所に絞り、食事の時間も確保しています。'],
      priority: ['試合に集中できるよう、スタジアムへのアクセスと時間の余裕を重視しています。', '座席カテゴリーを一段上げる前提で見積もっています（公式ホスピタリティも検討可）。', '観光は試合の前後に無理のない範囲で入れています。'],
    }[type].slice();
    if (cities.length === 1) highlights.push(`宿泊は${cityJa(cities[0])}のみ。荷物の移動が少なく楽です。`);
    else highlights.push(`${cities.map(cityJa).join('・')}を巡ります（都市間は鉄道で移動）。`);
    if (built.conn) highlights.push('乗継便を想定しているため、乗継時間と手荷物の扱いは予約時に確認してください。');

    const checklist = [
      '試合日程・キックオフ時刻をクラブまたはプレミアリーグの公式サイトで確認する（変更の可能性あり）',
      'チケットの販売状況・販売方法（一般販売／会員向け／公式ホスピタリティ）を公式サイトで確認する',
      '航空券とホテルの変更・キャンセル条件を確認する（試合日程の変更に備える）',
      'パスポートの有効期間と、英国への入国に必要な手続き（電子渡航認証など）を英国政府の公式情報で確認する',
      'スタジアムの入場ルール（手荷物の大きさ制限・禁止物）を確認する',
      '試合日の鉄道・バスの運行状況（運休・工事）を確認する',
      '海外旅行保険、スマートフォンの通信手段、為替・クレジットカードの準備',
    ];
    if (set.some(f => f.source === 'manual')) checklist.unshift('手入力した試合は、入力内容（日付・時刻・会場）が公式発表と一致しているか必ず確認する');
    if (set.some(f => f.timeAssumed)) checklist.unshift('キックオフ時刻が未入力の試合は15:00と仮定しています。公式の時刻を確認してください');
    if (!origin.direct) checklist.push(`${origin.ja}発は乗継便を想定。国内線・国際線の乗継時間と預け荷物の扱いを確認する`);

    return {
      id: `${idBase}-${type}`, type, no: T.no, name: T.name,
      depart: win.D, ret: win.R, nights, days: built.days, matches: matchesOut,
      cities, lodging, transport: built.transport, spots: built.spots, foods: built.foods,
      costs, perPerson, groupTotal: perPerson * inp.people, diff, withinBudget: diff >= 0,
      people: inp.people, budget: inp.budget, highlights, checklist, flightInfo: { conn: built.conn, durOut: built.durOut, durBack: built.durBack },
      stadiumCities,
    };
  }

  // ---------- 本体 ----------
  function monthDays(month) { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function generate(inp, fixtures, meta, opts) {
    opts = opts || {};
    const today = opts.today || todayISO();
    const errors = validate(inp, today);
    if (Object.keys(errors).length) return { status: 'error', errors };

    const notices = [];
    const manualAll = (inp.manual || []).map((m, i) => {
      const club = m.home && m.home !== '_other' ? D.clubById[m.home] : null;
      return {
        id: 'manual-' + i, home: club ? club.id : null, homeName: club ? club.ja : (m.homeName || '').trim(),
        awayName: (m.awayName || '').trim() || '対戦相手未定', date: m.date, time: m.time || '15:00', timeAssumed: !m.time,
        venue: (m.venue || '').trim() || (club ? club.stadium : '会場未入力'), city: m.city,
        tier: club ? club.tier : 2, stadiumMin: club ? club.stadiumMin : 30, source: 'manual', ticketStatus: '要確認', req: true,
      };
    });

    // 旅行期間の候補
    let windows = [];
    if (inp.dateMode === 'dates') windows = [{ D: inp.depart, R: inp.ret }];
    else {
      const n = monthDays(inp.month);
      for (let s = 1; s <= n; s++) {
        const dd = `${inp.month}-${String(s).padStart(2, '0')}`;
        if (dd > today) windows.push({ D: dd, R: addDays(dd, inp.days - 1) });
      }
    }
    const inRange = (m, w) => m.date >= addDays(w.D, 1) && m.date <= addDays(w.R, -2);
    if (manualAll.length) {
      windows.forEach(w => { w.reqIn = manualAll.filter(m => inRange(m, w)).length; });
      const mx = Math.max(...windows.map(w => w.reqIn));
      windows = windows.filter(w => w.reqIn === mx);
      if (mx < manualAll.length) {
        const miss = manualAll.filter(m => !windows.some(w => inRange(m, w)));
        notices.push({ level: 'warn', text: `手入力した試合のうち「${miss.map(m => m.homeName + ' ' + fmtDate(m.date)).join('、')}」は、旅行期間（現地での観戦可能日）に入らないため組み込めません。` });
      }
    }
    if (!windows.length) return { status: 'nomatch', plans: [], notices, alternatives: [], reasons: ['指定された月に出発できる日がありません。'], meta, input: inp };

    const clubSet = new Set(inp.clubs);
    const baseFix = fixtures.filter(f => clubSet.has(f.home));
    const target = Math.min(5, Math.max(inp.matchCount, manualAll.length));
    const cache = {};
    const poolFor = (w, relaxed) => {
      const lo = addDays(w.D, 1), hi = addDays(w.R, -2);
      const man = manualAll.filter(m => inRange(m, w)).map(m => ({ ...m, req: !relaxed }));
      const dup = f => man.some(m => m.date === f.date && m.home && m.home === f.home);
      return baseFix.filter(f => f.date >= lo && f.date <= hi && !dup(f)).concat(man).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    };
    const sets = (w, k, sameCity, relaxed) => {
      const key = `${w.D}|${k}|${sameCity}|${relaxed}`;
      return cache[key] || (cache[key] = enumerate(poolFor(w, relaxed), k, w, sameCity, !relaxed));
    };

    let manualRelaxed = false;
    function best(type) {
      const ks = []; const top = (type === 'priority' && inp.matchCount === 3) ? 4 : target;
      for (let k = top; k >= 1; k--) ks.push(k);
      for (const relaxed of manualAll.length ? [false, true] : [true]) {
        const kk = relaxed ? ks : ks.filter(k => k >= manualAll.filter(m => windows.some(w => inRange(m, w))).length);
        for (const k of kk) {
          for (const sameCity of inp.style === 'move' ? [true, false] : [false]) {
            let b = null;
            for (const w of windows) for (const s of sets(w, k, sameCity, relaxed)) {
              const sc = scoreSet(s, type, inp.style);
              if (!b || sc > b.sc + 1e-9) b = { w, s, sc, k, sameCity, relaxed };
            }
            if (b) { if (relaxed && manualAll.length) manualRelaxed = true; return b; }
          }
        }
      }
      return null;
    }

    const results = {};
    for (const t of ['saver', 'balance', 'priority']) results[t] = best(t);
    const idBase = 'p' + Date.now().toString(36);

    if (!results.saver && !results.balance && !results.priority) {
      return { status: 'nomatch', plans: [], notices, alternatives: opts.noAlt ? [] : nomatchAlternatives(inp, fixtures, today), reasons: nomatchReasons(inp, fixtures, windows), meta, input: inp };
    }

    const plans = [];
    for (const t of ['saver', 'balance', 'priority']) {
      const r = results[t]; if (!r) continue;
      const p = makePlan(t, r.w, r.s, inp, meta, idBase);
      p.achieved = r.k;
      p.requested = (t === 'priority' && inp.matchCount === 3) ? 4 : target;
      plans.push(p);
    }

    const achieved = Math.max(...plans.map(p => p.achieved));
    if (manualRelaxed) notices.push({ level: 'warn', text: '手入力した試合を全て組み込むと、移動時間の都合で無理のある日程になるため、一部を外した案になっています。' });
    if (achieved < target && !manualRelaxed) notices.push({ level: 'warn', text: `ご希望の${target}試合を、移動に無理のない日程では組めませんでした（最大${achieved}試合の案です）。` });
    if (inp.style === 'move' && plans.some(p => p.cities.filter(c => c !== 'london').length > 0 && new Set(p.matches.map(m => m.city)).size > 1)) notices.push({ level: 'info', text: '「移動を少なくする」を優先しましたが、同じ都市だけでは希望の試合数を満たせないプランがあります。' });
    if (inp.dateMode === 'month') notices.push({ level: 'info', text: `${inp.month.replace('-', '年')}月の中で、試合に合わせて出発日を自動で選んでいます（プランごとに出発日が異なる場合があります）。` });

    const cheapest = Math.min(...plans.map(p => p.perPerson));
    let alternatives = [];
    const needAlt = cheapest > inp.budget || achieved < target;
    if (needAlt && !opts.noAlt) alternatives = buildAlternatives(inp, fixtures, meta, plans, cheapest, achieved, target, today);
    if (cheapest > inp.budget) notices.unshift({ level: 'warn', text: `予算が足りません。最も安い案でも1人あたり約${cheapest.toLocaleString()}円で、予算より約${(cheapest - inp.budget).toLocaleString()}円オーバーです。` });

    return { status: 'ok', plans, notices, alternatives, meta, input: inp, generatedAt: new Date().toISOString() };
  }

  function nomatchReasons(inp, fixtures, windows) {
    const r = [];
    const names = inp.clubs.map(id => D.clubById[id].ja).join('、');
    const cand = fixtures.filter(f => inp.clubs.includes(f.home));
    const inAny = cand.filter(f => windows.some(w => f.date >= addDays(w.D, 1) && f.date <= addDays(w.R, -2)));
    if (!inp.clubs.length) r.push('クラブが選ばれていないため、手入力の試合だけで探しましたが、旅行日程に収まる組み合わせがありませんでした。');
    else if (!inAny.length) r.push(`この期間に「${names}」のホーム試合が確認できませんでした。シーズンオフ（例：6〜7月）や、試合の間隔があいている期間の可能性があります。`);
    else r.push('ホーム試合はありますが、日本との往復日程（到着日と出発日は観戦不可）に収まる、または移動に無理のない組み合わせがありませんでした。');
    r.push('日程・クラブ・試合数を変えると見つかる場合があります。');
    return r;
  }

  function nomatchAlternatives(inp, fixtures, today) {
    const alts = [];
    const cand = fixtures.filter(f => inp.clubs.includes(f.home) && f.date > today);
    const byMonth = {};
    cand.forEach(f => { const m = f.date.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
    Object.keys(byMonth).sort().filter(m => m >= today.slice(0, 7)).slice(0, 12).sort((a, b) => byMonth[b] - byMonth[a] || a.localeCompare(b)).slice(0, 3).forEach(m => {
      alts.push({ title: `${m.replace('-', '年')}月に変更する`, text: `選んだクラブのデモ試合が${byMonth[m]}件あります（架空）。`, patch: { dateMode: 'month', month: m } });
    });
    if (inp.dateMode === 'dates' || inp.days < 8) alts.push({ title: '旅行日数を長くする（8日間）', text: '日数が長いほど、試合に合わせやすくなります。', patch: { dateMode: 'month', month: inp.month || today.slice(0, 7), days: 8 } });
    return alts;
  }

  function summarize(res) {
    if (!res || res.status !== 'ok') return null;
    const p = res.plans.slice().sort((a, b) => a.perPerson - b.perPerson)[0];
    return { total: p.perPerson, within: p.withinBudget, matches: Math.max(...res.plans.map(x => x.matches.length)) };
  }

  function buildAlternatives(inp, fixtures, meta, plans, cheapest, achieved, target, today) {
    const out = [];
    const tryIt = (patch, title, text) => {
      const next = { ...inp, ...patch };
      const r = generate(next, fixtures, meta, { noAlt: true, today });
      const s = summarize(r);
      if (s) out.push({ title, text, patch, summary: s });
    };
    if (cheapest > inp.budget) {
      if (inp.matchCount > 1) tryIt({ matchCount: inp.matchCount - 1 }, `観戦を${inp.matchCount - 1}試合にする`, 'チケット代と移動が減ります。');
      if (inp.dateMode === 'month' && inp.days > 4) tryIt({ days: inp.days - 1 }, `旅行を${inp.days - 1}日間にする`, '宿泊と食費が減ります。');
      if (inp.dateMode === 'dates' && diffDays(inp.depart, inp.ret) + 1 > 4) tryIt({ ret: addDays(inp.ret, -1) }, '帰国日を1日早める', '宿泊と食費が減ります。');
      if (inp.style !== 'budget') tryIt({ style: 'budget' }, '旅行スタイルを「費用を抑える」にする', 'チケットの価格帯が低い試合を優先して探します。');
      const need = Math.ceil(cheapest / 10000) * 10000;
      out.push({ title: `予算を約${need.toLocaleString()}円にする`, text: '「費用を抑えるプラン」が予算内になります。', patch: { budget: need }, summary: { total: cheapest, within: true, matches: plans.find(p => p.perPerson === cheapest).matches.length } });
    }
    if (achieved < target) {
      const before = out.length;
      if (inp.dateMode === 'month') [inp.days + 1, inp.days + 2, inp.days + 3].forEach(n => { if (n <= 21) tryIt({ days: n }, `旅行を${n}日間に延ばす`, '試合間の移動に余裕ができ、希望の試合数に届く場合があります。'); });
      else [1, 2, 3].forEach(n => tryIt({ ret: addDays(inp.ret, n) }, `帰国日を${n}日遅らせる`, '試合間の移動に余裕ができ、希望の試合数に届く場合があります。'));
      // 試合数が増えない案は除外
      for (let i = out.length - 1; i >= before; i--) if (out[i].summary.matches <= achieved) out.splice(i, 1);
    }
    const uniq = []; const seen = new Set();
    out.forEach(a => { const k = JSON.stringify(a.patch); if (!seen.has(k)) { seen.add(k); uniq.push(a); } });
    uniq.sort((a, b) => (b.summary.within - a.summary.within));
    return uniq.slice(0, 5);
  }

  FT.planner = { validate, generate, TYPES, util: { fmtDate, addDays, diffDays, todayISO, isBST, jstGap, toMin } };
})();
