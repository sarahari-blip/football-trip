# FOOTBALL TRIP（デモ版）
プレミアリーグ（リーグ戦のみ）の観戦旅行プランを作る日本語サイトです。

## 起動方法
`index.html` をダブルクリック（ブラウザで開く）。インストール・サーバー・外部通信は不要です。

## ファイル
- index.html / styles.css / app.js … 画面
- planner.js … プラン生成（ルールベース。外部通信なし）
- fixtures.js … 試合データの提供元（**架空**のデモ日程）
- data.js … クラブ・都市・観光・概算料金のデータ
- config.js … 設定（現在はデモのみ）

## アクセス計測（GTM・GA4・Clarity・サーチコンソール）
- `config.js` の `analytics` に各IDを入れると有効になります。**空欄の間は、外部への送信は一切ありません。**
  - `gtm` … `GTM-XXXXXXX` / `ga4` … `G-XXXXXXXXXX` / `clarity` … Clarityのプロジェクト（10文字ほどの英数字）
- IDを入れると、画面下に同意バナーが出ます。**「同意する」を押すまで、計測タグは読み込まれません。**
- 送るのは、ページ名（`/plan` `/results` など）とボタン操作の名前（`plan_submit` `plan_save` `plan_delete` `print` `sample_click` `alt_apply`）だけです。**予算・クラブ名・日程などの入力内容は送りません。**
- Clarityの画面録画では、条件入力フォームの中身を隠します（`data-clarity-mask`）。
- 注意：GTMとGA4の両方を直接入れているため、**GTMの管理画面にGA4のタグを追加しないでください**（二重に数えられます）。GTMには、それ以外のタグを追加してください。
- サーチコンソール：サイトを公開したあと、サーチコンソールで表示される確認コードを `index.html` の `<head>` にある `google-site-verification` の行（コメント）に入れて、コメントを外してください。公開URLが必要です（手元のファイルでは使えません）。
- 画面下の「計測の設定を変更」から、訪問者が同意を取り消せます。「プライバシーと計測について」の画面に、運営者名・連絡先などを公開前に追記してください。法的な表記が必要かどうかは、公開前に専門家へご確認ください。

## 実データにつなぐとき
fixtures.js の `FT.fixtureSource.load()` を、同じ形 `{fixtures:[...], meta:{source, sourceName, fetchedAt}}` を返すものに差し替えます。
APIキーが必要な場合は、ブラウザに置かず、サーバー側から取得したデータを渡してください。
planner.js の `FT.planner.generate` も同じ入出力の関数に差し替えればAIに置き換えられます。
