"use strict";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function mergeHeaders(extra = {}) {
  return {
    ...DEFAULT_HEADERS,
    ...extra,
  };
}

async function fetchText(url, options = {}) {
  const {
    method = "GET",
    headers = {},
    body,
    timeout = 20_000,
    redirect = "follow",
  } = options;

  const response = await fetch(url, {
    method,
    headers: mergeHeaders(headers),
    body,
    redirect,
    signal: AbortSignal.timeout(timeout),
  });

  const text = await response.text();

  if (!response.ok) {
    const preview = text.replace(/\s+/g, " ").slice(0, 180);

    throw new Error(
      `Request failed ${response.status} ${response.statusText} for ${url}` +
        (preview ? `: ${preview}` : "")
    );
  }

  return {
    url: response.url,
    status: response.status,
    headers: response.headers,
    text,
  };
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#038;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;/gi, "–")
    .replace(/&#8212;/gi, "—")
    .replace(/&#8217;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  DEFAULT_HEADERS,
  fetchText,
  decodeHtml,
  stripTags,
};
