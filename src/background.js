// Copyright 2026 YAMAZAKI Makoto
// SPDX-License-Identifier: Apache-2.0

// Service Worker（MV3）。
// content script からの依頼を受けて mfm.warhammer-community.com/ja/{slug} を取得する。
//
// なぜ背景で取得するか:
//   - host_permissions を持つ背景 fetch は cross-origin でも応答本文を読める（CORS 回避）。
//   - content script からの cross-origin fetch はページ由来として CORS 制約を受ける。
// 取得した HTML の解析（DOMParser 必須）は content script 側で行う。SW に DOMParser は無い。

const MFM_BASE = "https://mfm.warhammer-community.com/";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間
const CACHE_PREFIX = "mfm:";

// lang は "ja" | "en"。言語ごとにキャッシュする。
function cacheKey(lang, slug) {
  return `${CACHE_PREFIX}${lang}:${slug}`;
}

async function readCache(lang, slug) {
  const key = cacheKey(lang, slug);
  const obj = await chrome.storage.local.get(key);
  const entry = obj[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS && typeof entry.html === "string") {
    return entry.html;
  }
  return null;
}

async function writeCache(lang, slug, html) {
  await chrome.storage.local.set({ [cacheKey(lang, slug)]: { html, ts: Date.now() } });
}

async function fetchLang(lang, slug) {
  const cached = await readCache(lang, slug);
  if (cached) return cached;
  const res = await fetch(`${MFM_BASE}${lang}/${slug}`, {
    headers: { Accept: "text/html" },
    credentials: "omit"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${lang})`);
  const html = await res.text();
  await writeCache(lang, slug, html);
  return html;
}

async function fetchMfm(slug) {
  // 日本語(必須)と英語(誤訳の正体判定に使う。取れなくても続行)を並行取得する。
  const [jaResult, enResult] = await Promise.allSettled([
    fetchLang("ja", slug),
    fetchLang("en", slug)
  ]);
  if (jaResult.status !== "fulfilled") {
    return { ok: false, error: jaResult.reason ? String(jaResult.reason.message || jaResult.reason) : "ja fetch failed" };
  }
  return {
    ok: true,
    jaHtml: jaResult.value,
    enHtml: enResult.status === "fulfilled" ? enResult.value : null
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "fetchMfm" && typeof msg.slug === "string") {
    fetchMfm(msg.slug)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true; // 非同期応答のためチャネルを開いたままにする
  }
  return false;
});
