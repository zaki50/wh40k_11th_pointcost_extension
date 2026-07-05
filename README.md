# WH40k 11版 ポイントコスト表示 Chrome拡張

wikiwiki.jp の「ウォーハンマー40,000（11版）日本語プレイヤーwiki」のユニットデータページを開いたとき、
そのページには載っていない**ポイントコスト**を、公式の Munitorum Field Manual（mfm）から取得して
ページ先頭に挿入して表示します。

## 動作の仕組み

1. content script が wiki ページの URL から**アーミー名**と**ユニット名**を抽出します。
   - 対象 URL: `https://wikiwiki.jp/40k-11th/アーミー/{日本語アーミー名}/ユニットデータ/{日本語ユニット名}`
   - 該当ユニットの wiki ページが未作成（HTTP 404）でも、URL さえ整っていれば動作します。
2. 日本語アーミー名を英語スラッグに変換します（`src/army-map.js` の対応表）。
3. Service Worker が `https://mfm.warhammer-community.com/ja/{slug}` と `.../en/{slug}` を
   並行取得します。
   - `host_permissions` により背景 fetch で CORS を回避。取得結果は言語ごとに 24 時間キャッシュ。
   - 英語版は「誤訳された同名ユニットの正体判定」に使います（下記）。取得に失敗しても日本語版のみで続行します。
4. content script が HTML を解析し、URL のユニット名（日本語）と一致するユニットの
   ポイントコストを探してカードとして挿入します。

### 日本語版の翻訳バグへの対応（/en 突き合わせ）

mfm の日本語版には、英語版では別ユニットのものが同じ日本語名になる翻訳バグがあります。
例: 英語の **Dreadnought**（135pt）と **Redemptor Dreadnought**（195/210pt）が、
日本語ではどちらも「リデンプター・ドレッドノート」。

`/ja` と `/en` はユニットの件数・並び順が完全に一致するため、位置で突き合わせて各ユニットに
**正しい英語名**を付与し、英語名を「正体」として重複除去します（別ユニットを消さずに両方保持）。
カードにも英語名を併記します。

wiki のページ名が誤訳側で mfm/ja に一致しない場合（例: wiki「ドレッドノート」）は、
`src/normalize.js` の `ARMY_NAME_TO_EN` に **wiki 日本語名 → 英語名** を登録して英語名で引きます。

### 表示するポイントの種類

mfm に記載される以下のバリエーションをすべて表示します。

- **モデル数別のポイント**（例: インターセッサー・スカッド 5体=80pt / 10体=150pt）
- **ロスターへの編入順によるポイント**（例: アグレッサー・スカッド 1個目〜2個目=90pt / 3個目=100pt、
  アストラエウス 1個目=525pt / 2個目=575pt）
- 同名ユニットが別サブファクション等で複数掲載される場合は、`groupTitle`（チャプター名など）を
  見出しに付けて全件表示します。

なお mfm /ja では同一ユニットがストリーミング上で重複レンダリングされることがあります
（例: スペースマリーンの「リデンプター・ドレッドノート」が 135pt 版と 195/210pt 版の 2 枚）。
同一グループ内の同名重複は、情報が最も完全な（コスト行数が最も多い）エントリに集約します。

### mfm の HTML 解析について

mfm は Next.js の React Server Components ストリーミングを使っており、ポイント値は
最初のカード内ではなく `<div hidden id="S:xx">` に置かれ、`<script>$RS("S:xx","P:xx")</script>`
で `<template id="P:xx">` へ差し込まれます。DOMParser はスクリプトを実行しないため、
`src/mfm-parser.js` がこの `$RS` / `$RC` を自前で再現してから解析しています。

## ファイル構成

```
manifest.json          # MV3 マニフェスト
src/background.js       # Service Worker: mfm 取得 + キャッシュ
src/content.js          # wiki ページ側: URL解析・マッチング・カード挿入
src/army-map.js         # 日本語アーミー名 → 英語スラッグ 対応表
src/mfm-parser.js       # mfm HTML → ユニット/ポイント配列
src/normalize.js        # ユニット名の正規化・別名解決
styles/inject.css       # 挿入カードのスタイル
safari/                 # Safari 用 Xcode プロジェクト（上記リソースを相対参照）
```

## インストール（開発版）

### Chrome / Edge 等

1. `chrome://extensions` を開く。
2. 右上の「デベロッパーモード」をオンにする。
3. 「パッケージ化されていない拡張機能を読み込む」で、このリポジトリのフォルダを選択する。

### Firefox

1. `about:debugging#/runtime/this-firefox` を開く。
2. 「一時的なアドオンを読み込む」で、このリポジトリの `manifest.json` を選択する。

Chrome と Firefox は単一の `manifest.json` で両対応しています（`background` に
`service_worker`（Chrome 用）と `scripts`（Firefox 用）の両方を記載）。
Firefox は Manifest V3 の `service_worker` をサポートしないため `scripts`（イベントページ）で
同じ `src/background.js` を実行します。ブラウザ API は `chrome.*` を使用しており、Firefox の
互換シムでそのまま動作します。

### Safari

Safari は WebExtension を macOS/iOS アプリに埋め込む形で動かします。
`safari/WH40kPointCost/` に Apple 公式ツール（`safari-web-extension-converter`）で生成した
Xcode プロジェクトを同梱しています。拡張リソースはリポジトリ直下の `manifest.json` /
`src` / `styles` / `icons` を相対参照しているため、コードはブラウザ間で単一です。

1. `safari/WH40kPointCost/WH40kPointCost.xcodeproj` を Xcode で開く。
2. スキーム「WH40kPointCost (macOS)」を選び、自分の Apple ID で署名して Run
   （無料アカウントでもローカル実行可）。
3. Safari → 設定 → 詳細 →「Web 開発者向けの機能を表示」を ON。
4. Safari → 設定 → 機能拡張 で「WH40kPointCost」を有効化し、`wikiwiki.jp` および
   `mfm.warhammer-community.com` へのアクセスを許可する。

プロジェクトを再生成する場合（`safari/` を削除してから）:

```sh
xcrun safari-web-extension-converter . \
  --project-location safari \
  --app-name "WH40kPointCost" \
  --bundle-identifier org.zakky.wh40k-pointcost --no-open
```

生成直後は拡張リソースの参照先が変換時の作業ディレクトリ絶対パスになるため、
`safari/WH40kPointCost/WH40kPointCost.xcodeproj/project.pbxproj` 内の該当パスを
リポジトリ直下への相対参照（`../../../manifest.json` 等）に直す必要があります。

App Store への配布には Apple Developer Program（年額）とアプリ審査が必要です。

## 動作確認

- 例: `https://wikiwiki.jp/40k-11th/アーミー/スペースマリーン/ユニットデータ/キャプテン`
  を開くと、ページ上部に「ポイントコスト: キャプテン 1体: 80 pt」のカードが表示される。
- 別アーミー（例: ネクロン、タウ・エンパイア）でも対応表経由で表示される。

## ユニット名がマッチしないとき

wiki と mfm の表記ゆれは `src/normalize.js` の正規化（中黒・空白・全半角・括弧の吸収）で
概ね吸収されますが、それでも一致しない場合は `ARMY_NAME_ALIASES` に
`{ [normalizeUnitName(wiki名)]: "mfm原文名" }` を追記して個別対応できます。

## 既知の制約

- データ元は公式 mfm の**日本語ページ**。翻訳が未反映のユニットは表示できないことがあります。
- 個別ユニットの wiki ページは多くが未作成のため、URL を直接開く形での利用が中心になります。
- `titan-legions` / `chaos-titan-legions` は wiki 非掲載のため対象外です。

## ライセンス

このプロジェクトは [Apache License 2.0](LICENSE) のもとで公開しています。

    Copyright 2026 YAMAZAKI Makoto

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

なお、本拡張は Games Workshop の非公式なファンツールであり、Games Workshop とは無関係です。
Warhammer 40,000 等の名称・データは Games Workshop の著作物・商標です。
