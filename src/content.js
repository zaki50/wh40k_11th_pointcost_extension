// Copyright 2026 YAMAZAKI Makoto
// SPDX-License-Identifier: Apache-2.0

// wikiwiki.jp/40k-11th のユニットデータページで動作するメインスクリプト。
// URL からアーミー名・ユニット名を取り出し、mfm のポイントコストをページ先頭に挿入する。
//
// 対象 URL: https://wikiwiki.jp/40k-11th/アーミー/{日本語アーミー名}/ユニットデータ/{日本語ユニット名}
// ※ 該当ユニットの wiki ページが未作成（HTTP 404）でも、URL さえ整っていれば動作する。

(function () {
  const CARD_ID = "wh40k-pointcost-card";
  // このカードが拡張機能による挿入であることを示すラベル（wiki 本文と区別するため）。
  const EXT_NAME = "WH40k ポイントコスト表示";

  // location.pathname から [アーミー名, ユニット名] を取り出す。対象外なら null。
  function parseWikiPath() {
    // 例: /40k-11th/アーミー/スペースマリーン/ユニットデータ/キャプテン
    const segs = location.pathname.split("/").filter(Boolean).map((s) => {
      try {
        return decodeURIComponent(s);
      } catch (_) {
        return s;
      }
    });
    // ["40k-11th","アーミー","{army}","ユニットデータ","{unit}"]
    const i = segs.indexOf("アーミー");
    if (i < 0) return null;
    if (segs[i + 2] !== "ユニットデータ") return null;
    const army = segs[i + 1];
    const unit = segs[i + 3];
    if (!army || !unit) return null;
    return { army, unit };
  }

  // 挿入先アンカーを返す。
  function findAnchor() {
    return (
      document.getElementById("body") ||
      document.getElementById("content") ||
      document.body
    );
  }

  // カード要素を（再）生成して挿入する。
  function renderCard(buildInner) {
    const anchor = findAnchor();
    if (!anchor) return;
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement("div");
      card.id = CARD_ID;
      anchor.insertBefore(card, anchor.firstChild);
    }
    card.textContent = "";
    // 拡張機能による挿入であることが分かるバッジを常に先頭に出す。
    const badge = el("div", "wh40k-pc-badge");
    badge.appendChild(el("span", "wh40k-pc-badge-mark", "🔨"));
    badge.appendChild(el("span", null, `拡張機能「${EXT_NAME}」による挿入`));
    card.appendChild(badge);
    buildInner(card);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // mfm /en のユニット名は全大文字なので、表示用に各単語の頭文字だけ大文字化する。
  function titleCaseEn(s) {
    return (s || "").toLowerCase().replace(/(^|[\s(])([a-z])/g, (_, p, c) => p + c.toUpperCase());
  }

  function renderLoading(army, unit) {
    renderCard((card) => {
      card.appendChild(el("div", "wh40k-pc-title", "ポイントコスト"));
      card.appendChild(el("div", "wh40k-pc-note", `読み込み中… (${army} / ${unit})`));
    });
  }

  function renderMessage(text) {
    renderCard((card) => {
      card.appendChild(el("div", "wh40k-pc-title", "ポイントコスト"));
      card.appendChild(el("div", "wh40k-pc-note wh40k-pc-error", text));
    });
  }

  // 1 ユニット分（各価格帯・各モデル数）のポイント一覧を描画する。
  // showHeader が真のときは、複数エントリを区別するための見出し（英語名 / groupTitle）を出す。
  function renderPricing(container, unit, showHeader) {
    if (showHeader) {
      const parts = [];
      if (unit.enName) parts.push(titleCaseEn(unit.enName));
      if (unit.groupTitle) parts.push(unit.groupTitle);
      if (parts.length) container.appendChild(el("div", "wh40k-pc-group", parts.join(" / ")));
    }
    for (const tier of unit.pricing) {
      const block = el("div", "wh40k-pc-tier");
      // ラベルが「自軍ユニットのポイントコスト」だけの単純ケースは冗長なので出し分ける。
      if (unit.pricing.length > 1 || tier.label !== "自軍ユニットのポイントコスト") {
        block.appendChild(el("div", "wh40k-pc-label", tier.label));
      }
      const ul = el("ul", "wh40k-pc-costs");
      for (const c of tier.costs) {
        const li = el("li");
        const models = c.models ? `${c.models}: ` : "";
        li.appendChild(el("span", "wh40k-pc-models", models));
        li.appendChild(el("span", "wh40k-pc-points", `${c.points} pt`));
        ul.appendChild(li);
      }
      block.appendChild(ul);
      container.appendChild(block);
    }
  }

  // matches は同名の複数エントリ（誤訳による同名衝突・別サブファクション等）になり得るため、全件表示する。
  function renderUnit(matches, sourceUrl) {
    renderCard((card) => {
      const title = el("div", "wh40k-pc-title");
      title.appendChild(el("span", null, "ポイントコスト: "));
      title.appendChild(el("span", "wh40k-pc-unitname", matches[0].name));
      // 単一エントリなら英語名をタイトルに併記して正体を明示する。
      if (matches.length === 1 && matches[0].enName) {
        title.appendChild(el("span", "wh40k-pc-en", ` (${titleCaseEn(matches[0].enName)})`));
      }
      card.appendChild(title);

      // 複数エントリのときは各ブロックに見出し（英語名 / グループ）を付けて区別する。
      const showHeader = matches.length > 1;
      for (const unit of matches) renderPricing(card, unit, showHeader);

      const src = el("div", "wh40k-pc-source");
      const a = el("a", null, "出典: Munitorum Field Manual (mfm)");
      a.href = sourceUrl;
      a.target = "_blank";
      a.rel = "noopener";
      src.appendChild(a);
      card.appendChild(src);
    });
  }

  // mfm のユニット配列から、wiki のユニット名に一致するもの（複数可）を探す。無ければ空配列。
  function findUnits(units, slug, wikiUnitName) {
    // 0) 英語名オーバーライド（mfm /ja の誤訳対策）。登録があれば英語名で一意に引く。
    const enOverride = resolveEnglishName(slug, wikiUnitName);
    if (enOverride) {
      const byEn = units.filter(
        (u) => u.enName && u.enName.toLowerCase() === enOverride.toLowerCase()
      );
      if (byEn.length) return byEn;
    }

    // 1) 日本語名の完全一致
    const exact = units.filter((u) => u.name === wikiUnitName);
    if (exact.length) return exact;

    // 2) 日本語名の正規化一致（同名の別ユニットが誤訳で並ぶ場合は全件返し、表示側で英語名を併記する）
    const key = normalizeUnitName(wikiUnitName);
    return units.filter((u) => normalizeUnitName(u.name) === key);
  }

  function main() {
    const parsed = parseWikiPath();
    if (!parsed) return; // ユニットデータページでなければ何もしない

    const { army, unit } = parsed;
    const slug = ARMY_SLUG_MAP[army];
    if (!slug) {
      renderMessage(`未対応のアーミーです (${army})`);
      return;
    }

    renderLoading(army, unit);
    const sourceUrl = `https://mfm.warhammer-community.com/ja/${slug}`;

    chrome.runtime.sendMessage({ type: "fetchMfm", slug }, (resp) => {
      if (chrome.runtime.lastError) {
        renderMessage(`ポイント情報の取得に失敗しました: ${chrome.runtime.lastError.message}`);
        return;
      }
      if (!resp || !resp.ok) {
        renderMessage(
          `ポイント情報を取得できませんでした (${resp && resp.error ? resp.error : "不明なエラー"})`
        );
        return;
      }
      let units;
      try {
        units = parseMfmHtml(resp.jaHtml, resp.enHtml);
      } catch (e) {
        renderMessage(`ポイント情報の解析に失敗しました: ${String(e && e.message ? e.message : e)}`);
        return;
      }
      const matched = findUnits(units, slug, unit);
      if (!matched.length) {
        renderMessage(`ポイント情報が見つかりませんでした (アーミー: ${army} / ユニット: ${unit})`);
        return;
      }
      renderUnit(matched, sourceUrl);
    });
  }

  main();
})();
