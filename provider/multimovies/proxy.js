"use strict";

const crypto = require("crypto");
const { Readable } = require("stream");
const { USER_AGENT } = require("./http");

const ALLOWED_HOSTS = [
  "smoothpre.com",
  "onlineartacademy.site",
  "dramiyos-cdn.com",
  "telescopesforsale.space",
  "acek-cdn.com",
  "goldenfieldcreativeworks.store",
  "mountainbikeriding.space",
];
const PASSTHROUGH_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

function allowedHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return ALLOWED_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
}

function sign(target, referer, secret) {
  return crypto.createHmac("sha256", secret).update(`${target}\n${referer}`).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function makeProxyUrl(base, target, referer, secret) {
  const sig = sign(target, referer, secret);
  return `${base}/api/multimovies-hls-proxy?url=${encodeURIComponent(target)}&referer=${encodeURIComponent(referer)}&sig=${sig}`;
}

function rewritePlaylist(body, playlistUrl, referer, proxyBase, secret) {
  const wrap = value => makeProxyUrl(proxyBase, new URL(value, playlistUrl).href, referer, secret);
  return String(body).split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith("#")) return line.replace(/URI="([^"]+)"/gi, (_, uri) => `URI="${wrap(uri)}"`);
    return wrap(trimmed);
  }).join("\n");
}

async function handleProxy(req, res, query, options) {
  const { secret, proxyBase } = options;
  if (!secret) throw new Error("MULTIMOVIES_PROXY_SECRET is required");
  let target;
  try { target = new URL(String(query.url || "")); } catch { target = null; }
  const referer = String(query.referer || "");
  if (!target || target.protocol !== "https:" || !allowedHost(target.hostname)) {
    res.statusCode = 403; return res.end("Unsupported MultiMovies host");
  }
  if (!safeEqual(query.sig, sign(target.href, referer, secret))) {
    res.statusCode = 403; return res.end("Invalid MultiMovies proxy signature");
  }
  const origin = new URL(referer).origin;
  const headers = { Accept: "*/*", "User-Agent": USER_AGENT, Referer: referer, Origin: origin };
  if (req.headers.range) headers.Range = req.headers.range;
  const upstream = await fetch(target, { headers, redirect: "follow", signal: AbortSignal.timeout(25_000) });
  const finalUrl = new URL(upstream.url || target.href);
  if (!allowedHost(finalUrl.hostname)) {
    upstream.body?.cancel(); res.statusCode = 403; return res.end("Unsafe MultiMovies redirect");
  }
  res.statusCode = upstream.status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  const contentType = String(upstream.headers.get("content-type") || "").toLowerCase();
  const playlist = /mpegurl/.test(contentType) || /\.(?:m3u8|txt)$/i.test(finalUrl.pathname);
  if (playlist && upstream.ok) {
    const body = await upstream.text();
    res.removeHeader("content-length");
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-store");
    return res.end(rewritePlaylist(body, finalUrl, referer, proxyBase, secret));
  }
  res.setHeader("Cache-Control", upstream.ok ? "public, max-age=3600" : "no-store");
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).on("error", () => res.destroy()).pipe(res);
}

module.exports = { ALLOWED_HOSTS, allowedHost, handleProxy, makeProxyUrl, rewritePlaylist, sign };
