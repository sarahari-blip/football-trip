/* FOOTBALL TRIP - 試合データの提供元（デモ）
   ★ ここで作る日程は「架空」です。実際の試合日程ではありません。
   後から実データに替える場合は、FT.fixtureSource.load() が同じ形のデータ
   { fixtures:[...], meta:{ source, sourceName, fetchedAt } } を返すように差し替えるだけです。
   （外部通信は一切行いません） */
globalThis.FT = globalThis.FT || {};
(function () {
  const FT = globalThis.FT;
  const D = FT.data;
  const MS = 86400000;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const addDays = (s, n) => iso(parse(s) + n * MS);
  const dow = s => new Date(parse(s)).getUTCDay();
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  const KO = { 6: ['12:30', '15:00', '17:30'], 0: ['14:00', '16:30'], 1: ['20:00'], 3: ['20:00'] };

  function build() {
    const out = [];
    for (const c of D.clubs) {
      const r = rng(hash(c.id));
      let cur = addDays('2026-08-22', Math.floor(r() * 6));
      let n = 0;
      while (cur < '2029-06-01') {
        // シーズンオフ（5/25〜8/14）は試合なし
        const inOff = d => d.slice(5) >= '05-25' && d.slice(5) < '08-15';
        if (inOff(cur)) { cur = `${cur.slice(0, 4)}-08-${15 + Math.floor(r() * 7)}`; continue; }
        const targets = [6, 6, 6, 0, 0, 1, 3];
        const want = targets[Math.floor(r() * targets.length)];
        let d = cur;
        while (dow(d) !== want) d = addDays(d, 1);
        if (!inOff(d)) {
          const times = KO[want];
          const opp = D.clubs.filter(x => x.id !== c.id)[Math.floor(r() * (D.clubs.length - 1))];
          out.push({
            id: `demo-${c.id}-${n++}`, home: c.id, homeName: c.ja, awayName: opp.ja,
            date: d, time: times[Math.floor(r() * times.length)],
            venue: c.stadium, city: c.city, tier: c.tier, stadiumMin: c.stadiumMin,
            source: 'demo', ticketStatus: '要確認',
          });
        }
        cur = addDays(d, 7 + Math.floor(r() * 7));
      }
    }
    return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  let cache = null;
  FT.fixtureSource = {
    // 実データに替える場合はここを差し替える（同じ形で返す）
    async load() {
      await new Promise(r => setTimeout(r, 500)); // 読み込み中表示の確認用
      cache = cache || build();
      return {
        fixtures: cache,
        meta: { source: 'demo', sourceName: 'デモ：架空の日程・概算料金', fetchedAt: null },
      };
    },
    loadSync() { cache = cache || build(); return { fixtures: cache, meta: { source: 'demo', sourceName: 'デモ：架空の日程・概算料金', fetchedAt: null } }; },
  };
})();
