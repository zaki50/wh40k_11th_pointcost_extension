// Copyright 2026 YAMAZAKI Makoto
// SPDX-License-Identifier: Apache-2.0

// mfm.warhammer-community.com/{ja,en}/{slug} の HTML 文字列を解析して
// ユニットごとのポイントコスト一覧を取り出す。
//
// 重要: mfm は Next.js の React Server Components ストリーミングを使っており、
// ポイント値は最初のカード内には無く、下記の形で「別の場所」に置かれている:
//
//   <template id="P:73"></template>                          ← カード内プレースホルダ
//   <div hidden id="S:73"><span>80 ポイント</span></div>     ← 実データ
//   <script>$RS("S:73","P:73")</script>                       ← S:73 の中身を P:73 に移す指示
//
// ブラウザは $RS を実行して穴埋めするが、DOMParser はスクリプトを実行しない。
// そのため $RS（および Suspense 境界の $RC）を自前で再現してから解析する。

// $RS / $RC を再現して DOM を完成させる。
function resolveStreaming(doc) {
  const scripts = doc.querySelectorAll("script");
  for (const s of scripts) {
    const t = s.textContent || "";

    // $RS("S:x","P:y"): #S:x の子要素を #P:y（template）の位置へ移動する。
    const rs = t.match(/\$RS\("([^"]+)","([^"]+)"\)/);
    if (rs) {
      const src = doc.getElementById(rs[1]);
      const tpl = doc.getElementById(rs[2]);
      if (src && tpl) {
        const frag = doc.createDocumentFragment();
        while (src.firstChild) frag.appendChild(src.firstChild);
        tpl.replaceWith(frag);
      }
      continue;
    }

    // $RC("B:x","S:y"): Suspense 境界を確定し #S:y を表示する。
    // querySelectorAll は hidden を無視するため解析上は必須ではないが、念のため解除する。
    const rc = t.match(/\$RC\("([^"]+)","([^"]+)"\)/);
    if (rc) {
      const src = doc.getElementById(rc[2]);
      if (src) src.removeAttribute("hidden");
    }
  }
}

// "80 ポイント"（日本語）/ "80 pts"（英語）/ "1,200 ポイント" 等から数値を取り出す。取れなければ null。
function extractPoints(text) {
  const m = (text || "").match(/([\d,]+)\s*(?:ポイント|pts?)/i);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
}

// HTML 文字列を、ユニットの見出し順（重複除去なし）にパースする。
//   [{ name, groupTitle, pricing: [{ label, costs: [{ models, points }] }] }]
// /ja でも /en でも同じ構造・同じ並び順なので、両言語をこの関数で解析して
// インデックスで対応付け（zip）できる。
function parseMfmUnits(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  resolveStreaming(doc);

  const units = [];
  // グループ見出し（h3.font-header, 例「ユニット」やチャプター名）とユニット名の見出しを
  // 文書順に走査し、各ユニットへ直前のグループ名（groupTitle）を割り当てる。
  const nodes = doc.querySelectorAll("h3.font-header, div.bg-slate-500.text-xl");
  let groupTitle = "";
  for (const node of nodes) {
    if (node.tagName === "H3") {
      groupTitle = (node.textContent || "").trim();
      continue;
    }
    const nameEl = node;
    const name = (nameEl.textContent || "").trim();
    if (!name) continue;

    // 名前 div の親がそのユニットのカード。ポイント表記はこのカード内に限定される。
    const card = nameEl.parentElement;
    if (!card) continue;

    const pricing = [];
    // 価格帯ラベル（bg-slate-200）の直後にある ul.leaders を価格帯として読む。
    // 英語版はラベル文字列が違う（"Your Unit Costs" 等）ため、ラベル文言ではなく
    // 「直後に leaders リストがあるか」で価格帯かどうかを判定する。これによりデタッチメントの
    // エンハンスメント（leaders 直後構造を持たない）は自然に除外される。
    const labels = card.querySelectorAll("div.bg-slate-200");
    for (const label of labels) {
      const labelText = (label.textContent || "").trim();

      let ul = label.nextElementSibling;
      while (ul && ul.tagName !== "UL") ul = ul.nextElementSibling;
      if (!ul || !/\bleaders\b/.test(ul.className || "")) continue;

      const costs = [];
      for (const li of ul.querySelectorAll(":scope > li")) {
        const span = li.querySelector("span");
        const models = span ? (span.textContent || "").trim() : "";
        const points = extractPoints((li.textContent || "").replace(/\s+/g, " "));
        if (points !== null) costs.push({ models, points });
      }
      if (costs.length) pricing.push({ label: labelText, costs });
    }

    if (pricing.length) units.push({ name, groupTitle, pricing });
  }
  return units;
}

// /ja（必須）と /en（任意）を解析し、各ユニットに正しい英語名（enName）を付与して返す。
// mfm 日本語版には翻訳バグで別ユニットが同名になる例がある（例: 英語の "Dreadnought"=135pt と
// "Redemptor Dreadnought"=195/210pt が、日本語ではどちらも「リデンプター・ドレッドノート」）。
// /en と位置対応させて英語名を正体として使い、英語名基準で重複除去することで別ユニットを保持する。
function parseMfmHtml(jaHtml, enHtml) {
  const jaUnits = parseMfmUnits(jaHtml);
  const enUnits = enHtml ? parseMfmUnits(enHtml) : null;

  // 件数・並び順が一致していれば index で英語名を対応付ける（全アーミーで一致を確認済み）。
  if (enUnits && enUnits.length === jaUnits.length) {
    for (let i = 0; i < jaUnits.length; i++) jaUnits[i].enName = enUnits[i].name;
  }
  return dedupeUnits(jaUnits);
}

// 重複除去。英語名（あれば）を正体キーに使い、無ければ日本語の正規化名で代用する。
// - 別ユニットが誤訳で同じ日本語名になっていても、英語名が異なれば別物として両方残る。
// - 同一ユニットがストリーミング上で重複していても、英語名が同じなのでまとまる。
// - 同キーが複数あるときはコスト行数が最も多い（＝最も情報が完全な）エントリを残す。
function dedupeUnits(units) {
  const totalRows = (u) => u.pricing.reduce((a, t) => a + t.costs.length, 0);
  const identity = (u) =>
    u.enName ? "en:" + u.enName.toLowerCase() : "ja:" + normalizeUnitName(u.name);
  const byKey = new Map();
  const order = [];
  for (const u of units) {
    const key = identity(u);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, u);
      order.push(key);
    } else if (totalRows(u) > totalRows(prev)) {
      byKey.set(key, u);
    }
  }
  return order.map((k) => byKey.get(k));
}
