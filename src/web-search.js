import { JSDOM } from "jsdom";

import { WEB_SEARCH_MAX_RESULTS, WEB_SEARCH_SOURCE_COUNT } from "./config.js";

const DUCK_DUCK_GO_HTML_ORIGIN = "https://html.duckduckgo.com";
const DUCK_DUCK_GO_HTML_URL = `${DUCK_DUCK_GO_HTML_ORIGIN}/html/`;
const DEFAULT_SEARCH_TIMEOUT_MS = 20_000;
const EXPLICIT_SEARCH_PATTERN = /^(?:검색|search)\b/i;
const STRONG_TIME_SENSITIVE_PATTERN =
  /(최신|실시간|업데이트|뉴스|주가|가격|기온|날씨|발표|출시|오늘|현재|방금)/i;
const RELATIVE_TIME_PATTERN = /(오늘|지금|현재|최근|이번 주|이번주|이번 달|이번달|어제|내일)/i;
const TIMELY_TOPIC_PATTERN =
  /(날씨|기온|뉴스|주가|가격|일정|결과|순위|환율|업데이트|발표|출시|영업시간|운영시간)/i;
const SOURCE_REQUEST_PATTERN =
  /(출처|링크|참고|source|sources|reference|references|url)/i;

export async function searchWeb(query, options = {}) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return { query: "", results: [] };
  }

  const maxResults = clampInteger(options.maxResults, 1, 20, WEB_SEARCH_MAX_RESULTS);
  const timeoutMs = clampInteger(options.timeoutMs, 1_000, 60_000, DEFAULT_SEARCH_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const results = await performDuckDuckGoHtmlSearch(normalizedQuery, {
      region: options.region,
      signal: controller.signal,
    });

    return {
      query: normalizedQuery,
      results: results.slice(0, maxResults),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function shouldUseWebSearch(prompt) {
  const text = normalizeSearchText(prompt);
  if (!text) {
    return false;
  }

  return EXPLICIT_SEARCH_PATTERN.test(text)
    || STRONG_TIME_SENSITIVE_PATTERN.test(text)
    || (RELATIVE_TIME_PATTERN.test(text) && TIMELY_TOPIC_PATTERN.test(text));
}

export function deriveWebSearchQuery(prompt) {
  const original = normalizeSearchText(prompt);
  if (!original) {
    return "";
  }

  const query = original
    .replace(/^(?:검색|search)\s*[:\-]?\s*/i, "")
    .replace(/\s+(?:검색|search)$/i, "")
    .replace(/\s*(?:검색해줘|검색해 줘|찾아줘|찾아 줘|알려줘|알려 줘)\s*$/i, "")
    .trim();

  return normalizeSearchText(query || original);
}

export function shouldIncludeWebSearchSources(prompt) {
  const text = normalizeSearchText(prompt);
  return Boolean(text) && SOURCE_REQUEST_PATTERN.test(text);
}

export function formatWebSearchContext(query, results, options = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedResults = Array.isArray(results) ? results : [];
  const searchedAtText = normalizeSearchText(options.searchedAtText ?? "");

  if (!normalizedQuery || normalizedResults.length === 0) {
    return "";
  }

  return [
    "[웹 검색 참고 결과]",
    searchedAtText ? `검색 시각: ${searchedAtText}` : "",
    `검색어: ${normalizedQuery}`,
    "최신 정보가 필요할 때는 아래 결과를 우선 참고하고, 검색 결과에 없는 사실은 추측하지 않는다.",
    ...normalizedResults.map((result, index) => {
      const lines = [
        `[${index + 1}] 제목: ${truncateText(result.title, 320)}`,
        `URL: ${result.url}`,
      ];

      if (result.snippet) {
        lines.push(`요약: ${truncateText(result.snippet, 1200)}`);
      }

      return lines.join("\n");
    }),
  ].filter(Boolean).join("\n");
}

export function formatWebSearchSources(results, options = {}) {
  const limit = clampInteger(options.limit, 1, 20, WEB_SEARCH_SOURCE_COUNT);
  const normalizedResults = Array.isArray(results) ? results : [];

  if (normalizedResults.length === 0) {
    return "";
  }

  return [
    "출처",
    ...normalizedResults.slice(0, limit).map((result, index) => (
      `${index + 1}. ${truncateText(result.title, 120)}\n${result.url}`
    )),
  ].join("\n");
}

function parseDuckDuckGoHtmlResults(html) {
  const dom = new JSDOM(String(html ?? ""));
  const document = dom.window.document;
  const nodes = [...document.querySelectorAll(".result")];
  const results = [];

  for (const node of nodes) {
    const anchor = node.querySelector(".result__title a.result__a, a.result__a");
    const snippetNode = node.querySelector(".result__snippet");
    const title = normalizeSearchText(anchor?.textContent ?? "");
    const url = unwrapDuckDuckGoResultUrl(anchor?.href ?? "");
    const snippet = normalizeSearchText(snippetNode?.textContent ?? "");

    if (!title || !url) {
      continue;
    }

    if (results.some((entry) => entry.url === url)) {
      continue;
    }

    results.push({ title, url, snippet });
  }

  return results;
}

function unwrapDuckDuckGoResultUrl(rawUrl) {
  const trimmed = String(rawUrl ?? "").trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed, DUCK_DUCK_GO_HTML_ORIGIN);
    const redirectTarget = url.searchParams.get("uddg");
    if (redirectTarget) {
      return redirectTarget;
    }

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }

  return "";
}

async function performDuckDuckGoHtmlSearch(query, options = {}) {
  const url = new URL(DUCK_DUCK_GO_HTML_URL);
  url.searchParams.set("q", normalizeSearchText(query));
  url.searchParams.set("kl", String(options.region ?? "kr-ko"));

  const response = await fetch(url, {
    headers: {
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent": [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "AppleWebKit/537.36 (KHTML, like Gecko)",
        "Chrome/137.0.0.0 Safari/537.36",
      ].join(" "),
    },
    signal: options.signal,
  });

  const html = await response.text();
  if (!response.ok) {
    const error = new Error(`DuckDuckGo HTML search failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return parseDuckDuckGoHtmlResults(html);
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const text = normalizeSearchText(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}
