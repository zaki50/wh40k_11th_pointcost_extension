// ユニット名マッチング用のユーティリティ。
// wiki（URL 由来）と mfm（HTML 由来）はどちらも日本語ユニット名だが、
// 中黒・空白・全半角・括弧などの表記ゆれがあるため正規化して比較する。

// 表記ゆれを吸収した比較キーを作る。
// - NFKC で全角/半角・互換文字を統一（（）→() など）
// - 空白除去
// - 中黒（・ U+30FB / ･ U+FF65 / · U+00B7）除去
// - 括弧（()（）[]【】）除去
// - 小文字化（ラテン文字が混ざる場合の保険）
function normalizeUnitName(name) {
  if (!name) return "";
  let s = name.normalize("NFKC");
  s = s.replace(/[\s　]/g, "");
  s = s.replace(/[・･·]/g, "");
  s = s.replace(/[()（）\[\]【】]/g, "");
  return s.toLowerCase();
}

// アーミー別の「wiki 日本語名 → 英語名（正体）」オーバーライド表。
// 主な用途は mfm 日本語版の翻訳バグ対策。mfm /ja は別ユニットを同じ日本語名にしてしまう
// ことがあり（例: 英語 "Dreadnought"=135pt と "Redemptor Dreadnought"=195/210pt が
// 日本語ではどちらも「リデンプター・ドレッドノート」）、日本語名だけでは正しく引けない。
// ここに wiki 側の日本語ページ名（正規化キー）→ 英語名 を登録すると、マッチングは英語名で行う。
//
// 値は mfm /en のユニット名（大文字小文字は無視して比較）。
const ARMY_NAME_TO_EN = {
  "space-marines": {
    // mfm /ja が両方「リデンプター・ドレッドノート」と誤訳しているため、wiki 側の
    // 各ページ名を正しい英語名にピン留めして区別する。
    [normalizeUnitName("ドレッドノート")]: "Dreadnought",
    [normalizeUnitName("リデンプター・ドレッドノート")]: "Redemptor Dreadnought"
  }
};

// wiki のユニット名から、対応する英語名（正体）を返す。無ければ null。
function resolveEnglishName(slug, wikiName) {
  const table = ARMY_NAME_TO_EN[slug];
  if (!table) return null;
  return table[normalizeUnitName(wikiName)] || null;
}
