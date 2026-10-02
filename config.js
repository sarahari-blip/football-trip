/* FOOTBALL TRIP 設定
   試合データのAPIには接続しません（デモのみ）。
   アクセス計測のIDを入れるまでは、外部への送信は一切起きません。 */
globalThis.FT = globalThis.FT || {};
globalThis.FT.config = {
  mode: 'demo',
  analytics: {
    gtm: 'GTM-WWJXPC3M', // Googleタグマネージャー  例: 'GTM-XXXXXXX'
    ga4: 'G-Q2DNJV0KZK', // Googleアナリティクス4   例: 'G-XXXXXXXXXX'
    clarity: 'yr5jzgisnn', // Microsoft Clarity       例: 'abcdefghij'
    // サーチコンソールは index.html の <head> にある確認用タグ（コメント部分）を有効にします
  },
};
