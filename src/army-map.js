// 日本語アーミー名 → mfm 英語スラッグ の対応表。
// wikiwiki.jp の URL 内アーミー名（例 ".../アーミー/スペースマリーン/..."）を
// https://mfm.warhammer-community.com/ja/{slug} の {slug} に変換するために使う。
//
// スラッグは BSData/wh40k-11e-mfm の data/ ディレクトリ（= mfm のファクションページ）に一致。
// wiki に掲載の無い titan-legions / chaos-titan-legions は対象外。
//
// content_scripts の各ファイルは同一スコープを共有するため、ここで定義した
// const ARMY_SLUG_MAP は content.js から参照できる。
const ARMY_SLUG_MAP = {
  // --- 帝国（インペリウム） ---
  "スペースマリーン": "space-marines",
  "ブラックテンプラー": "black-templars",
  "ブラッドエンジェル": "blood-angels",
  "ダークエンジェル": "dark-angels",
  "スペースウルフ": "space-wolves",
  "デスウォッチ": "deathwatch",
  "グレイナイト": "grey-knights",
  "アデプタ・ソロリタス": "adepta-sororitas",
  "アデプトゥス・カストーデス": "adeptus-custodes",
  "アデプトゥス・メカニカス": "adeptus-mechanicus",
  "アストラ・ミリタルム": "astra-militarum",
  "インペリアルナイト": "imperial-knights",
  "インペリアル・エージェント": "imperial-agents",

  // --- 渾沌（ケイオス） ---
  "ケイオス・スペースマリーン": "chaos-space-marines",
  "ワールドイーター": "world-eaters",
  "デスガード": "death-guard",
  "サウザンド・サン": "thousand-sons",
  "エンペラーズ・チルドレン": "emperors-children",
  "ケイオス・ディーモン": "chaos-daemons",
  "ケイオスナイト": "chaos-knights",

  // --- 異種族（ゼノ） ---
  "ティラニッド": "tyranids",
  "ジーンスティーラー・カルト": "genestealer-cults",
  "アエルダリ": "aeldari",
  "デュカーリ": "drukhari",
  "ネクロン": "necrons",
  "オルク": "orks",
  "タウ・エンパイア": "tau-empire",
  "リーグ・オヴ・ヴォータン": "leagues-of-votann"
};
