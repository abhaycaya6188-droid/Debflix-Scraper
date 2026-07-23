'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { handleMultiMovies } = require('../provider/multimovies/handler');

const MULTIMOVIES_TMDB_KEY =
  process.env.TMDB_API_KEY || '7bf6b8cf4d8a661e8a90ae825995471d';
const MULTIMOVIES_PROXY_SECRET =
  process.env.MULTIMOVIES_PROXY_SECRET ||
  crypto.createHash('sha256').update(`multimovies:${MULTIMOVIES_TMDB_KEY}`).digest('hex');

const REFERER = 'https://vidlink.pro/';
const ORIGIN = 'https://vidlink.pro';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

let bootPromise = null;

function bootWasm() {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    globalThis.window = globalThis;
    globalThis.self = globalThis;
    globalThis.document = { createElement: () => ({}), body: { appendChild: () => {} } };
    const sodium = require('libsodium-wrappers');
    await sodium.ready;
    globalThis.sodium = sodium;
    eval(fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8'));
    const go = new Dm();
    const wasmBuf = fs.readFileSync(path.join(__dirname, 'fu.wasm'));
    const { instance } = await WebAssembly.instantiate(wasmBuf, go.importObject);
    go.run(instance);
    await new Promise(resolve => setTimeout(resolve, 500));
    if (typeof globalThis.getAdv !== 'function') throw new Error('getAdv not found after WASM boot');
  })();
  return bootPromise;
}

async function getStream(id, season, episode) {
  await bootWasm();
  const token = globalThis.getAdv(String(id));
  if (!token) throw new Error('getAdv returned null');

  const apiUrl = season
    ? `https://vidlink.pro/api/b/tv/${token}/${season}/${episode || 1}?multiLang=0`
    : `https://vidlink.pro/api/b/movie/${token}?multiLang=0`;

  const response = await fetch(apiUrl, {
    headers: { Referer: REFERER, Origin: ORIGIN, 'User-Agent': UA },
  });
  if (!response.ok) throw new Error(`vidlink API returned ${response.status}`);
  const data = await response.json();
  const stream = data?.stream;
  if (!stream) throw new Error('No stream in response');
  if (stream.playlist) return stream.playlist;
  if (stream.qualities) {
    return (
      stream.qualities['1080']?.url ||
      stream.qualities['720']?.url ||
      stream.qualities['480']?.url ||
      Object.values(stream.qualities)[0]?.url
    );
  }
  throw new Error('Unknown VidLink response');
}

function decodeProxyHeaders(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(String(raw)));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const headers = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string' || !value.trim()) continue;
      if (/^(host|cookie|content-length|connection)$/i.test(key)) continue;
      headers[key] = value;
    }
    return headers;
  } catch {
    return {};
  }
}

function makeProxyUrl(proxyBase, absoluteUrl, headers) {
  let value = `${proxyBase}/api?url=` + encodeURIComponent(absoluteUrl);
  if (headers && Object.keys(headers).length) {
    value += '&headers=' + encodeURIComponent(JSON.stringify(headers));
  }
  return value;
}

function isMovieBoxHost(targetUrl) {
  try {
    return /(^|\.)hakunaymatata\.com$/i.test(new URL(targetUrl).hostname);
  } catch {
    return false;
  }
}

function fetchUpstream(targetUrl, headers, range, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));

    const cleanHeaders = { ...headers };
    // Some MovieBox CDN edges return an HTML/error body with HTTP 200 when an
    // Origin header is present. Signed resource URLs only need the downloader
    // referer and browser UA.
    if (isMovieBoxHost(targetUrl)) {
      delete cleanHeaders.Origin;
      delete cleanHeaders.origin;
    }

    const requestHeaders = {
      'User-Agent': cleanHeaders['User-Agent'] || cleanHeaders['user-agent'] || UA,
      Accept: cleanHeaders.Accept || cleanHeaders.accept || '*/*',
      'Accept-Encoding': 'identity',
      ...cleanHeaders,
    };
    if (range) requestHeaders.Range = range;

    const client = targetUrl.startsWith('https:') ? https : http;
    const request = client.get(targetUrl, { headers: requestHeaders }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const location = new URL(response.headers.location, targetUrl).href;
        response.resume();
        return resolve(fetchUpstream(location, cleanHeaders, range, redirects + 1));
      }
      resolve(response);
    });
    request.setTimeout(60000, () => request.destroy(new Error('upstream timeout')));
    request.on('error', reject);
  });
}

function preferEnglishAudio(line) {
  if (!/^#EXT-X-MEDIA:TYPE=AUDIO/i.test(line)) return line;
  const isEnglish = /(?:NAME|LANGUAGE)="English"/i.test(line);
  const withoutDefault = line.replace(/,DEFAULT=(?:YES|NO)/i, '');
  return `${withoutDefault},DEFAULT=${isEnglish ? 'YES' : 'NO'}`;
}

function rewriteM3u8(body, playlistUrl, headers, proxyBase) {
  const wrap = value => {
    try {
      return makeProxyUrl(proxyBase, new URL(value, playlistUrl).href, headers);
    } catch {
      return value;
    }
  };

  return String(body)
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (!trimmed.startsWith('#')) return wrap(trimmed);

      const preferred = preferEnglishAudio(line);
      return preferred.replace(/URI=("([^"]+)"|'([^']+)')/g, (_match, quoted, double, single) => {
        const quote = quoted[0];
        return `URI=${quote}${wrap(double || single)}${quote}`;
      });
    })
    .join('\n');
}

async function readPreview(stream, limit = 512) {
  const chunks = [];
  let received = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    chunks.push(buffer);
    received += buffer.length;
    if (received >= limit) break;
  }
  return Buffer.concat(chunks).subarray(0, limit);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  const parsed = new URL(req.url, 'http://localhost');
  const q = Object.fromEntries(parsed.searchParams);
  const pathname = parsed.pathname;
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || 'https').split(',', 1)[0].trim();
  const proxyBase = `${forwardedProtocol}://${req.headers.host}`;

  if (pathname === '/api/multimovies' || pathname === '/api/multimovies-hls-proxy') {
    return handleMultiMovies(req, res, pathname, q, {
      tmdbApiKey: MULTIMOVIES_TMDB_KEY,
      secret: MULTIMOVIES_PROXY_SECRET,
      proxyBase,
    });
  }

  if (q.url) {
    // URLSearchParams has already decoded the parameter. Decoding it again can
    // corrupt signed CDN URLs containing percent escapes.
    const targetUrl = String(q.url);
    const proxyHeaders = decodeProxyHeaders(q.headers);
    const range = req.headers.range || '';

    try {
      const upstream = await fetchUpstream(targetUrl, proxyHeaders, range);
      let contentType = String(upstream.headers['content-type'] || '').toLowerCase();
      const isM3u8 = contentType.includes('mpegurl') || /\.m3u8(?:\?|$)/i.test(targetUrl);
      const isMp4 = /\.mp4(?:\?|$)/i.test(targetUrl);

      // Do not forward provider error pages as successful video responses. That
      // was surfacing in Chromium as MEDIA_ELEMENT_ERROR code 4.
      if (
        !isM3u8 &&
        (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain'))
      ) {
        const preview = (await readPreview(upstream)).toString('utf8');
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          error: 'remote media proxy received non-media response',
          upstreamStatus: upstream.statusCode,
          contentType,
          preview: preview.slice(0, 300),
        }));
      }

      res.statusCode = upstream.statusCode || 502;
      for (const name of ['accept-ranges', 'cache-control', 'content-length', 'content-range', 'content-type', 'etag', 'last-modified']) {
        if (upstream.headers[name]) res.setHeader(name, upstream.headers[name]);
      }

      if (isMp4 && (!contentType || contentType === 'application/octet-stream')) {
        contentType = 'video/mp4';
        res.setHeader('Content-Type', 'video/mp4');
      }
      if (isMp4) {
        res.setHeader('Accept-Ranges', upstream.headers['accept-ranges'] || 'bytes');
        res.setHeader('Cache-Control', 'private, no-store');
      }

      if (isM3u8 && req.method !== 'HEAD') {
        const chunks = [];
        for await (const chunk of upstream) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString('utf8');
        res.removeHeader('Content-Length');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        return res.end(rewriteM3u8(body, targetUrl, proxyHeaders, proxyBase));
      }

      if (req.method === 'HEAD') return res.end();
      return upstream.pipe(res);
    } catch (error) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'remote media proxy failed', detail: String(error) }));
    }
  }

  if (!q.id) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'missing id' }));
  }

  res.setHeader('Content-Type', 'application/json');
  try {
    const streamUrl = await getStream(q.id, q.s, q.e);
    return res.end(JSON.stringify({ url: streamUrl }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: error.message }));
  }
};
