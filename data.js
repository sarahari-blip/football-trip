/* FOOTBALL TRIP - 静的データ（クラブ・都市・観光・空港）
   ※ 料金・所要時間はすべて「概算」。試合日程はここには含めない（fixtures.js のデモデータ）。 */
globalThis.FT = globalThis.FT || {};
(function () {
  const FT = globalThis.FT;

  // tier: チケット価格帯の目安 1(低)〜3(高) / stadiumMin: 中心部のホテルからスタジアムまでの目安(分)
  const clubs = [
    { id: 'arsenal', ja: 'アーセナル', en: 'Arsenal', city: 'london', stadium: 'エミレーツ・スタジアム', tier: 3, stadiumMin: 25, site: 'https://www.arsenal.com/' },
    { id: 'chelsea', ja: 'チェルシー', en: 'Chelsea', city: 'london', stadium: 'スタンフォード・ブリッジ', tier: 3, stadiumMin: 30, site: 'https://www.chelseafc.com/' },
    { id: 'tottenham', ja: 'トッテナム・ホットスパー', en: 'Tottenham Hotspur', city: 'london', stadium: 'トッテナム・ホットスパー・スタジアム', tier: 3, stadiumMin: 35, site: 'https://www.tottenhamhotspur.com/' },
    { id: 'westham', ja: 'ウェストハム・ユナイテッド', en: 'West Ham United', city: 'london', stadium: 'ロンドン・スタジアム', tier: 2, stadiumMin: 40, site: 'https://www.whufc.com/' },
    { id: 'fulham', ja: 'フラム', en: 'Fulham', city: 'london', stadium: 'クレイヴン・コテージ', tier: 2, stadiumMin: 40, site: 'https://www.fulhamfc.com/' },
    { id: 'brentford', ja: 'ブレントフォード', en: 'Brentford', city: 'london', stadium: 'ギテック・コミュニティ・スタジアム', tier: 2, stadiumMin: 45, site: 'https://www.brentfordfc.com/' },
    { id: 'palace', ja: 'クリスタル・パレス', en: 'Crystal Palace', city: 'london', stadium: 'セルハースト・パーク', tier: 2, stadiumMin: 50, site: 'https://www.cpfc.co.uk/' },
    { id: 'mancity', ja: 'マンチェスター・シティ', en: 'Manchester City', city: 'manchester', stadium: 'エティハド・スタジアム', tier: 3, stadiumMin: 25, site: 'https://www.mancity.com/' },
    { id: 'manutd', ja: 'マンチェスター・ユナイテッド', en: 'Manchester United', city: 'manchester', stadium: 'オールド・トラッフォード', tier: 3, stadiumMin: 30, site: 'https://www.manutd.com/' },
    { id: 'liverpool', ja: 'リヴァプール', en: 'Liverpool', city: 'liverpool', stadium: 'アンフィールド', tier: 3, stadiumMin: 30, site: 'https://www.liverpoolfc.com/' },
    { id: 'everton', ja: 'エヴァートン', en: 'Everton', city: 'liverpool', stadium: 'ヒル・ディキンソン・スタジアム', tier: 2, stadiumMin: 25, site: 'https://www.evertonfc.com/' },
    { id: 'newcastle', ja: 'ニューカッスル・ユナイテッド', en: 'Newcastle United', city: 'newcastle', stadium: 'セント・ジェームズ・パーク', tier: 2, stadiumMin: 10, site: 'https://www.nufc.co.uk/' },
    { id: 'villa', ja: 'アストン・ヴィラ', en: 'Aston Villa', city: 'birmingham', stadium: 'ヴィラ・パーク', tier: 2, stadiumMin: 25, site: 'https://www.avfc.co.uk/' },
    { id: 'brighton', ja: 'ブライトン', en: 'Brighton & Hove Albion', city: 'brighton', stadium: 'アメックス・スタジアム', tier: 2, stadiumMin: 35, site: 'https://www.brightonandhovealbion.com/' },
    { id: 'wolves', ja: 'ウルヴァーハンプトン', en: 'Wolverhampton Wanderers', city: 'wolverhampton', stadium: 'モリニュー・スタジアム', tier: 1, stadiumMin: 15, site: 'https://www.wolves.co.uk/' },
    { id: 'forest', ja: 'ノッティンガム・フォレスト', en: 'Nottingham Forest', city: 'nottingham', stadium: 'シティ・グラウンド', tier: 1, stadiumMin: 20, site: 'https://www.nottinghamforest.co.uk/' },
    { id: 'bournemouth', ja: 'ボーンマス', en: 'AFC Bournemouth', city: 'bournemouth', stadium: 'ヴァイタリティ・スタジアム', tier: 1, stadiumMin: 25, site: 'https://www.afcb.co.uk/' },
    { id: 'leeds', ja: 'リーズ・ユナイテッド', en: 'Leeds United', city: 'leeds', stadium: 'エランド・ロード', tier: 2, stadiumMin: 25, site: 'https://www.leedsunited.com/' },
  ];

  // hotelRate: 2人1室・1泊の概算(円)
  const cities = {
    london: { ja: 'ロンドン', lat: 51.51, lon: -0.13, hotelRate: 24000, area: 'キングス・クロス／ウェストミンスター周辺（地下鉄・鉄道の乗り換えが便利）' },
    manchester: { ja: 'マンチェスター', lat: 53.48, lon: -2.24, hotelRate: 16000, area: 'シティセンター（ピカデリー駅周辺）' },
    liverpool: { ja: 'リヴァプール', lat: 53.41, lon: -2.98, hotelRate: 15000, area: 'ライム・ストリート駅〜アルバート・ドック周辺' },
    newcastle: { ja: 'ニューカッスル', lat: 54.97, lon: -1.61, hotelRate: 14000, area: '中央駅周辺・クエイサイド' },
    birmingham: { ja: 'バーミンガム', lat: 52.48, lon: -1.9, hotelRate: 14000, area: 'ニュー・ストリート駅周辺' },
    brighton: { ja: 'ブライトン', lat: 50.82, lon: -0.14, hotelRate: 17000, area: 'ブライトン駅〜ザ・レーンズ周辺' },
    wolverhampton: { ja: 'ウルヴァーハンプトン', lat: 52.59, lon: -2.13, hotelRate: 11000, area: '駅周辺（宿は少なめ。バーミンガム泊も選択肢）' },
    nottingham: { ja: 'ノッティンガム', lat: 52.95, lon: -1.15, hotelRate: 12500, area: '市街中心部（オールド・マーケット・スクエア周辺）' },
    bournemouth: { ja: 'ボーンマス', lat: 50.72, lon: -1.88, hotelRate: 14000, area: 'ビーチ〜駅周辺' },
    leeds: { ja: 'リーズ', lat: 53.8, lon: -1.55, hotelRate: 13000, area: 'リーズ駅周辺' },
  };

  // direct: 直行便を想定するか（実際の運航は時期・航空会社で変わるため要確認）
  const airports = [
    { id: 'HND', ja: '羽田空港（東京）', mult: 1.0, direct: true },
    { id: 'NRT', ja: '成田空港（東京）', mult: 0.97, direct: true },
    { id: 'KIX', ja: '関西国際空港（大阪）', mult: 1.02, direct: false },
    { id: 'NGO', ja: '中部国際空港（名古屋）', mult: 1.05, direct: false },
    { id: 'FUK', ja: '福岡空港', mult: 1.1, direct: false },
    { id: 'CTS', ja: '新千歳空港（札幌）', mult: 1.15, direct: false },
    { id: 'OKA', ja: '那覇空港（沖縄）', mult: 1.2, direct: false },
  ];

  // 月ごとの航空券の季節係数（概算）
  const season = { 1: 0.95, 2: 0.9, 3: 0.95, 4: 1.05, 5: 1.0, 6: 1.05, 7: 1.2, 8: 1.25, 9: 1.05, 10: 1.0, 11: 0.92, 12: 1.25 };

  const interests = [
    { id: 'walk', ja: '街歩き', icon: 'compass' },
    { id: 'gourmet', ja: 'グルメ', icon: 'fork' },
    { id: 'history', ja: '歴史・文化', icon: 'book' },
    { id: 'shopping', ja: 'ショッピング', icon: 'bag' },
    { id: 'football', ja: 'サッカー関連', icon: 'ball' },
  ];

  // 観光スポット（cost: 入場料の概算(円) / hours: 所要時間）。入場料は変動するため要確認
  const S = (id, name, tags, cost, hours, area) => ({ id, name, tags, cost, hours, area });
  const spots = {
    london: [
      S('l-bm', '大英博物館', ['history'], 0, 2.5, 'ブルームズベリー'),
      S('l-tower', 'ロンドン塔', ['history'], 5500, 2.5, 'タワー・ヒル'),
      S('l-west', 'ウェストミンスター〜テムズ川沿い散策', ['walk', 'history'], 0, 2, 'ウェストミンスター'),
      S('l-borough', 'ボロー・マーケット', ['gourmet'], 0, 1.5, 'ロンドン・ブリッジ'),
      S('l-covent', 'コヴェント・ガーデン周辺', ['shopping', 'walk'], 0, 2, 'コヴェント・ガーデン'),
      S('l-oxford', 'オックスフォード・ストリート／リージェント・ストリート', ['shopping'], 0, 2, 'ウェスト・エンド'),
      S('l-camden', 'カムデン・マーケット', ['shopping', 'gourmet'], 0, 2, 'カムデン'),
      S('l-tate', 'テート・モダン', ['history'], 0, 2, 'サウスバンク'),
      S('l-notting', 'ノッティング・ヒル散策', ['walk'], 0, 1.5, 'ノッティング・ヒル'),
    ],
    manchester: [
      S('m-nfm', '国立サッカー博物館', ['football', 'history'], 2500, 2, '大聖堂周辺'),
      S('m-nq', 'ノーザン・クォーター散策', ['walk', 'shopping', 'gourmet'], 0, 2, 'ノーザン・クォーター'),
      S('m-msi', '科学産業博物館', ['history'], 0, 2, 'キャッスルフィールド'),
      S('m-cath', 'マンチェスター大聖堂周辺', ['history', 'walk'], 0, 1, '大聖堂周辺'),
      S('m-arndale', 'アーンデール・センター', ['shopping'], 0, 1.5, 'シティセンター'),
    ],
    liverpool: [
      S('v-dock', 'ロイヤル・アルバート・ドック', ['walk', 'gourmet'], 0, 2, 'アルバート・ドック'),
      S('v-beatles', 'ビートルズ・ストーリー', ['history'], 3800, 2, 'アルバート・ドック'),
      S('v-cath', 'リヴァプール大聖堂', ['history', 'walk'], 0, 1.5, '大聖堂周辺'),
      S('v-one', 'リヴァプール・ONE（ショッピング街）', ['shopping'], 0, 2, 'シティセンター'),
      S('v-baltic', 'バルティック・トライアングル（ストリートフード）', ['gourmet'], 0, 1.5, 'バルティック・トライアングル'),
    ],
    newcastle: [
      S('n-quay', 'クエイサイドとタイン川の橋めぐり', ['walk'], 0, 2, 'クエイサイド'),
      S('n-castle', 'ニューカッスル城（キープ）', ['history'], 1800, 1.5, '中央駅付近'),
      S('n-grainger', 'グレインジャー・マーケット', ['gourmet', 'shopping'], 0, 1.5, 'グレインジャー・タウン'),
      S('n-eldon', 'エルドン・スクエア', ['shopping'], 0, 1.5, 'シティセンター'),
      S('n-baltic', 'バルティック現代美術館', ['history'], 0, 2, 'ゲーツヘッド'),
    ],
    birmingham: [
      S('b-bull', 'ブルリング', ['shopping'], 0, 2, 'シティセンター'),
      S('b-jq', 'ジュエリー・クォーター', ['history', 'walk'], 0, 2, 'ジュエリー・クォーター'),
      S('b-canal', 'ブリンドリープレイス運河沿い散策', ['walk'], 0, 1.5, 'ブリンドリープレイス'),
      S('b-digbeth', 'ディグベス（ストリートフード）', ['gourmet'], 0, 2, 'ディグベス'),
      S('b-bmag', 'バーミンガム博物館・美術館', ['history'], 0, 2, 'シティセンター'),
    ],
    brighton: [
      S('br-pav', 'ロイヤル・パビリオン', ['history'], 2800, 1.5, 'ブライトン中心部'),
      S('br-pier', 'ブライトン・ピアと海岸沿い散策', ['walk'], 0, 2, '海沿い'),
      S('br-lanes', 'ザ・レーンズ', ['shopping', 'gourmet'], 0, 2, 'ザ・レーンズ'),
    ],
    wolverhampton: [
      S('w-church', 'セント・ピーターズ教会周辺', ['history', 'walk'], 0, 1, '市中心部'),
      S('w-art', 'ウルヴァーハンプトン美術館', ['history'], 0, 1.5, '市中心部'),
      S('w-bclm', 'ブラック・カントリー生活博物館', ['history'], 3200, 3, 'ダドリー（バス・電車で移動）'),
      S('w-mander', 'マンダー・センター', ['shopping'], 0, 1.5, '市中心部'),
    ],
    nottingham: [
      S('nt-castle', 'ノッティンガム城', ['history'], 1800, 1.5, '市中心部'),
      S('nt-oms', 'オールド・マーケット・スクエア', ['walk', 'shopping'], 0, 1.5, '市中心部'),
      S('nt-lace', 'レース・マーケット散策', ['walk', 'history'], 0, 1.5, 'レース・マーケット'),
      S('nt-caves', 'シティ・オブ・ケイヴス（洞窟見学）', ['history'], 1900, 1.5, '市中心部'),
    ],
    bournemouth: [
      S('bo-beach', 'ボーンマス・ビーチと桟橋', ['walk'], 0, 2, '海沿い'),
      S('bo-gardens', 'ロウアー・ガーデンズ', ['walk'], 0, 1.5, '市中心部'),
      S('bo-rc', 'ラッセル＝コーツ美術館', ['history'], 1500, 1.5, '東クリフ'),
      S('bo-sq', 'ボーンマス・スクエア周辺', ['shopping'], 0, 1.5, '市中心部'),
    ],
    leeds: [
      S('le-arm', 'ロイヤル・アーマリーズ博物館', ['history'], 0, 2, 'クラレンス・ドック'),
      S('le-kirk', 'カークゲート・マーケット', ['gourmet', 'shopping'], 0, 1.5, '市中心部'),
      S('le-vq', 'ヴィクトリア・クォーター', ['shopping'], 0, 2, '市中心部'),
      S('le-canal', '運河沿い散策', ['walk'], 0, 1.5, 'リーズ駅周辺'),
    ],
  };

  // 食事の候補（店名ではなく料理・エリアのタイプ。cost は1食あたり概算）
  const F = (name, tags, cost) => ({ name, tags, cost });
  const foods = {
    london: [F('パブでフィッシュ&チップス', [], 2800), F('ボロー・マーケットの屋台グルメ', ['gourmet'], 2500), F('サンデーロースト（日曜の定番）', ['gourmet'], 3800), F('インド料理（カレー）', ['gourmet'], 2800), F('アフタヌーンティー', ['gourmet'], 6000)],
    manchester: [F('ノーザン・クォーターのカフェでブランチ', ['gourmet'], 2500), F('カレー・マイル（インド・パキスタン料理街）', ['gourmet'], 2400), F('パブ料理とクラフトビール', [], 3000)],
    liverpool: [F('スカウス（名物の煮込み料理）', ['gourmet'], 2200), F('アルバート・ドックのカフェ', [], 2600), F('パブ料理', [], 3000)],
    newcastle: [F('パブでパイ・パブ料理', [], 2800), F('グレインジャー・マーケットの軽食', ['gourmet'], 1800), F('クエイサイドのレストラン', ['gourmet'], 3500)],
    birmingham: [F('バルティ（鍋ごと出すカレー）', ['gourmet'], 2400), F('ディグベスのストリートフード', ['gourmet'], 2000), F('パブ料理', [], 3000)],
    brighton: [F('海辺のフィッシュ&チップス', [], 2600), F('ザ・レーンズのカフェ', ['gourmet'], 2600), F('シーフードレストラン', ['gourmet'], 4500)],
    wolverhampton: [F('パブ料理', [], 2800), F('インド系レストラン', ['gourmet'], 2400), F('駅周辺のカフェ', [], 1800)],
    nottingham: [F('歴史あるパブでの食事', [], 3000), F('市場周辺のカフェ', [], 2000), F('インド料理', ['gourmet'], 2400)],
    bournemouth: [F('海沿いのカフェ', [], 2200), F('フィッシュ&チップス', [], 2600), F('シーフード', ['gourmet'], 4200)],
    leeds: [F('カークゲート・マーケットの軽食', ['gourmet'], 1800), F('パブ料理', [], 3000), F('インド料理', ['gourmet'], 2400)],
  };

  // 直線距離から鉄道の所要時間と運賃を概算（実際の時刻・運賃とは異なる）
  function km(a, b) {
    const A = cities[a], B = cities[b], R = 6371, r = Math.PI / 180;
    const dLat = (B.lat - A.lat) * r, dLon = (B.lon - A.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function trainHours(a, b) {
    if (a === b) return 0;
    return Math.round((0.5 + km(a, b) / 130) * 4) / 4;
  }
  function trainCost(a, b) {
    if (a === b) return 0;
    return Math.round((3500 + km(a, b) * 28) / 100) * 100;
  }

  FT.data = {
    clubs, cities, airports, season, interests, spots, foods,
    clubById: Object.fromEntries(clubs.map(c => [c.id, c])),
    airportById: Object.fromEntries(airports.map(a => [a.id, a])),
    trainHours, trainCost,
    TICKET_BASE: { 1: 11000, 2: 17000, 3: 26000 }, // チケット価格の概算(円)
  };
})();
