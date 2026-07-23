
"use strict";

const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");
const { Readable } = require("stream");
const { USER_AGENT } = require("./http");

const MAX_REDIRECTS = 5;

const PASSTHROUGH_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];

function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

function allowedReferer(referer) {
  let parsed;

  try {
    parsed = new URL(String(referer || ""));
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = normalizeHostname(parsed.hostname);

  return host === "smoothpre.com" || host.endsWith(".smoothpre.com");
}

function isBlockedIpv4(address) {
  const parts = address.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b, c] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function isBlockedIpv6(address) {
  const value = String(address || "")
    .toLowerCase()
    .split("%")[0];

  if (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89ab]/.test(value)
  ) {
    return true;
  }

  const mappedIpv4 = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (mappedIpv4) {
    return isBlockedIpv4(mappedIpv4[1]);
  }

  return false;
}

function isBlockedIp(address) {
  const family = net.isIP(address);

  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);

  return true;
}

async function resolvePublicHost(hostname) {
  const host = normalizeHostname(hostname);

  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return false;
  }

  if (net.isIP(host)) {
    return !isBlockedIp(host);
  }

  let records;

  try {
    records = await dns.lookup(host, {
      all: true,
      verbatim: true,
    });
  } catch {
    return false;
  }

  if (!records.length) return false;

  return records.every(record => !isBlockedIp(record.address));
}

async function allowedTarget(target, referer) {
  if (!(target instanceof URL)) return false;
  if (target.protocol !== "https:") return false;
  if (target.username || target.password) return false;
  if (!allowedReferer(referer)) return false;

  return resolvePublicHost(target.hostname);
}

function sign(target, referer, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${target}\n${referer}`)
    .digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function makeProxyUrl(base, target, referer, secret) {
  const sig = sign(target, referer, secret);

  return (
    `${base}/api/multimovies-hls-proxy` +
    `?url=${encodeURIComponent(target)}` +
    `&referer=${encodeURIComponent(referer)}` +
    `&sig=${sig}`
  );
}

function rewritePlaylist(
  body,
  playlistUrl,
  referer,
  proxyBase,
  secret
) {
  const wrap = value => {
    const absoluteUrl = new URL(value, playlistUrl).href;

    return makeProxyUrl(
      proxyBase,
      absoluteUrl,
      referer,
      secret
    );
  };

  return String(body)
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();

      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(
          /URI="([^"]+)"/gi,
          (_, uri) => `URI="${wrap(uri)}"`
        );
      }

      return wrap(trimmed);
    })
    .join("\n");
}

async function fetchValidatedTarget(
  initialTarget,
  referer,
  headers,
  redirects = 0
) {
  if (redirects > MAX_REDIRECTS) {
    throw new Error("Too many MultiMovies redirects");
  }

  if (!(await allowedTarget(initialTarget, referer))) {
    const error = new Error("Unsafe MultiMovies target");
    error.statusCode = 403;
    throw error;
  }

  const response = await fetch(initialTarget, {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(25_000),
  });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get("location")
  ) {
    const redirectedTarget = new URL(
      response.headers.get("location"),
      initialTarget
    );

    response.body?.cancel();

    return fetchValidatedTarget(
      redirectedTarget,
      referer,
      headers,
      redirects + 1
    );
  }

  return {
    response,
    finalUrl: initialTarget,
  };
}

async function handleProxy(req, res, query, options) {
  const { secret, proxyBase } = options;

  if (!secret) {
    throw new Error("MULTIMOVIES_PROXY_SECRET is required");
  }

  let target;

  try {
    target = new URL(String(query.url || ""));
  } catch {
    target = null;
  }

  const referer = String(query.referer || "");

  if (!target || !(await allowedTarget(target, referer))) {
    res.statusCode = 403;
    return res.end("Unsupported MultiMovies target");
  }

  if (!safeEqual(query.sig, sign(target.href, referer, secret))) {
    res.statusCode = 403;
    return res.end("Invalid MultiMovies proxy signature");
  }

  const origin = new URL(referer).origin;

  const headers = {
    Accept: "*/*",
    "User-Agent": USER_AGENT,
    Referer: referer,
    Origin: origin,
  };

  if (req.headers.range) {
    headers.Range = req.headers.range;
  }

  let upstream;
  let finalUrl;

  try {
    const result = await fetchValidatedTarget(
      target,
      referer,
      headers
    );

    upstream = result.response;
    finalUrl = result.finalUrl;
  } catch (error) {
    res.statusCode = error?.statusCode || 502;

    return res.end(
      error?.statusCode === 403
        ? "Unsafe MultiMovies redirect"
        : "MultiMovies upstream request failed"
    );
  }

  res.statusCode = upstream.status;
  res.setHeader("Access-Control-Allow-Origin", "*");

  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);

    if (value) {
      res.setHeader(name, value);
    }
  }

  const contentType = String(
    upstream.headers.get("content-type") || ""
  ).toLowerCase();

  const playlist =
    /mpegurl/.test(contentType) ||
    /\.(?:m3u8|txt)$/i.test(finalUrl.pathname);

  if (playlist && upstream.ok) {
    const body = await upstream.text();

    res.removeHeader("content-length");
    res.setHeader(
      "Content-Type",
      "application/vnd.apple.mpegurl"
    );
    res.setHeader("Cache-Control", "no-store");

    return res.end(
      rewritePlaylist(
        body,
        finalUrl,
        referer,
        proxyBase,
        secret
      )
    );
  }

  res.setHeader(
    "Cache-Control",
    upstream.ok
      ? "public, max-age=3600"
      : "no-store"
  );

  if (!upstream.body) {
    return res.end();
  }

  Readable.fromWeb(upstream.body)
    .on("error", () => res.destroy())
    .pipe(res);
}

module.exports = {
  allowedReferer,
  allowedTarget,
  handleProxy,
  makeProxyUrl,
  rewritePlaylist,
  sign,
};