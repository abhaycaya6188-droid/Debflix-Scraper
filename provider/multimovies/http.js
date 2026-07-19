"use strict";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

class CookieSession {
  constructor(timeoutMs = 15_000) {
    this.timeoutMs = timeoutMs;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  remember(response) {
    const values = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
    for (const value of values) {
      const pair = String(value).split(";", 1)[0];
      const split = pair.indexOf("=");
      if (split > 0) this.cookies.set(pair.slice(0, split).trim(), pair.slice(split + 1).trim());
    }
  }

  async fetch(input, init = {}, redirects = 0) {
    if (redirects > 5) throw new Error("Too many redirects");
    const headers = new Headers(init.headers || {});
    headers.set("User-Agent", headers.get("User-Agent") || USER_AGENT);
    const cookie = this.cookieHeader();
    if (cookie) headers.set("Cookie", cookie);
    const response = await fetch(input, {
      ...init,
      headers,
      redirect: "manual",
      signal: init.signal || AbortSignal.timeout(this.timeoutMs),
    });
    this.remember(response);
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      const next = new URL(response.headers.get("location"), input).href;
      return this.fetch(next, { ...init, method: "GET", body: undefined }, redirects + 1);
    }
    return response;
  }
}

async function responseText(response, label) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  return text;
}

module.exports = { CookieSession, USER_AGENT, responseText };
