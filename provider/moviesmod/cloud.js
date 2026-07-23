
"use strict";

const { DEFAULT_HEADERS, decodeHtml } = require("./http");

const CLOUD_ORIGIN = "https://cloud.unblockedgames.world";

function extractInput(html, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const pattern = new RegExp(
    `name=["']${escaped}["'][^>]*value=["']([^"']+)["']`,
    "i"
  );

  const match = String(html || "").match(pattern);

  return match ? decodeHtml(match[1]) : "";
}

function extractFormAction(html, formId = "landing") {
  const escaped = String(formId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const pattern = new RegExp(
    `<form\\b[^>]*id=["']${escaped}["'][^>]*action=["']([^"']+)["']`,
    "i"
  );

  const match = String(html || "").match(pattern);

  return match ? decodeHtml(match[1]) : "";
}

function extractVerification(html) {
  const cookieMatch = String(html || "").match(
    /s_343\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*(\d+)\s*\)/
  );

  const goMatch = String(html || "").match(
    /setAttribute\(\s*["']href["']\s*,\s*["']([^"']+\?go=[^"']+)["']\s*\)/
  );

  if (!cookieMatch || !goMatch) {
    throw new Error("Cloud verification cookie or go URL missing");
  }

  return {
    cookieName: cookieMatch[1],
    cookieValue: cookieMatch[2],
    cookieMinutes: Number(cookieMatch[3]),
    goUrl: decodeHtml(goMatch[1]),
  };
}

function extractMetaRefresh(html) {
  const match = String(html || "").match(
    /http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i
  );

  return match ? decodeHtml(match[1].trim()) : "";
}

function parseSetCookies(headers) {
  const values =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie")]
        : [];

  return values
    .map((value) => String(value).split(";")[0])
    .filter(Boolean);
}

function mergeCookies(existing, additions) {
  const jar = new Map();

  for (const cookie of [...existing, ...additions]) {
    const separator = cookie.indexOf("=");

    if (separator < 1) continue;

    const name = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    if (name) jar.set(name, value);
  }

  return [...jar.entries()].map(([name, value]) => `${name}=${value}`);
}

async function request(url, options = {}) {
  const {
    method = "GET",
    referer,
    origin,
    cookies = [],
    body,
  } = options;

  const headers = {
    ...DEFAULT_HEADERS,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Upgrade-Insecure-Requests": "1",
  };

  if (referer) headers.Referer = referer;
  if (origin) headers.Origin = origin;
  if (cookies.length) headers.Cookie = cookies.join("; ");

  if (body !== undefined) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Cloud request failed with HTTP ${response.status}`);
  }

  return {
    url: response.url,
    text,
    cookies: parseSetCookies(response.headers),
  };
}

async function resolveCloudLink(cloudUrl) {
  let cookies = [];

  const first = await request(cloudUrl, {
    referer: "https://links.modpro.blog/",
  });

  cookies = mergeCookies(cookies, first.cookies);

  const wpHttp = extractInput(first.text, "_wp_http");

  if (!wpHttp) {
    throw new Error("Cloud first-stage _wp_http token missing");
  }

  const firstBody = new URLSearchParams();
  firstBody.set("_wp_http", wpHttp);

  const second = await request(`${CLOUD_ORIGIN}/`, {
    method: "POST",
    referer: cloudUrl,
    origin: CLOUD_ORIGIN,
    cookies,
    body: firstBody.toString(),
  });

  cookies = mergeCookies(cookies, second.cookies);

  const action = extractFormAction(second.text);
  const wpHttp2 = extractInput(second.text, "_wp_http2");
  const token = extractInput(second.text, "token");

  if (!action || !wpHttp2 || !token) {
    throw new Error("Cloud second-stage form data missing");
  }

  const secondBody = new URLSearchParams();
  secondBody.set("_wp_http2", wpHttp2);
  secondBody.set("token", token);

  const third = await request(action, {
    method: "POST",
    referer: `${CLOUD_ORIGIN}/`,
    origin: CLOUD_ORIGIN,
    cookies,
    body: secondBody.toString(),
  });

  cookies = mergeCookies(cookies, third.cookies);

  const verification = extractVerification(third.text);

  cookies = mergeCookies(cookies, [
    `${verification.cookieName}=${verification.cookieValue}`,
  ]);

  const final = await request(verification.goUrl, {
    referer: action,
    cookies,
  });

  const driveSeedUrl = extractMetaRefresh(final.text);

  if (!driveSeedUrl || !/^https:\/\/driveseed\.org\//i.test(driveSeedUrl)) {
    throw new Error("DriveSeed redirect missing from cloud response");
  }

  return {
    cloudUrl,
    driveSeedUrl,
  };
}

module.exports = {
  extractInput,
  extractFormAction,
  extractVerification,
  extractMetaRefresh,
  resolveCloudLink,
};