"use strict";

const cheerio = require("cheerio");
const { responseText } = require("./http");
const { BASE_URL } = require("./search");

function playerCandidates(html, type, season, episode) {
  const $ = cheerio.load(html);
  const values = [];
  $("[data-post][data-nume][data-type]").each((_, element) => {
    const node = $(element);
    const text = node.text().replace(/\s+/g, " ").trim();
    const value = {
      post: node.attr("data-post"), nume: node.attr("data-nume"),
      type: node.attr("data-type"), text,
    };
    if (type === "tv" && season && episode) {
      const patterns = [new RegExp(`S0*${season}\\s*E0*${episode}\\b`, "i"), new RegExp(`Episode\\s*0*${episode}\\b`, "i")];
      value.episodeMatch = patterns.some(pattern => pattern.test(text));
    }
    values.push(value);
  });
  const exact = values.filter(value => value.episodeMatch);
  return exact.length ? exact : values;
}

function episodePageUrl(html, season, episode, seriesUrl) {
  const $ = cheerio.load(html);
  let match = null;
  $('a[href*="/episodes/"]').each((_, element) => {
    if (match) return;
    const href = $(element).attr("href");
    let target;
    try { target = new URL(href, seriesUrl); } catch { return; }
    const slugMatch = target.pathname.match(/-(\d+)x(\d+)\/?$/i);
    if (
      slugMatch &&
      Number(slugMatch[1]) === Number(season) &&
      Number(slugMatch[2]) === Number(episode)
    ) match = target.href;
  });
  if (!match) throw new Error(`MultiMovies episode ${season}x${episode} not found`);
  return match;
}

async function resolveDooplay(pageUrl, options, session) {
  let pageResponse = await session.fetch(pageUrl, { headers: { Referer: `${BASE_URL}/` } });
  let html = await responseText(pageResponse, "MultiMovies title page");
  if (options.type === "tv") {
    pageUrl = episodePageUrl(html, options.season, options.episode, pageUrl);
    pageResponse = await session.fetch(pageUrl, { headers: { Referer: `${BASE_URL}/` } });
    html = await responseText(pageResponse, "MultiMovies episode page");
  }
  const players = playerCandidates(html, options.type, options.season, options.episode);
  if (!players.length) throw new Error("MultiMovies page has no Dooplay player data");
  for (const player of players.slice(0, 4)) {
    const body = new URLSearchParams({ action: "doo_player_ajax", post: player.post, nume: player.nume, type: player.type });
    const ajax = await session.fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
      method: "POST", body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: BASE_URL, Referer: pageUrl, "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!ajax.ok) continue;
    const data = await ajax.json().catch(() => null);
    if (data?.embed_url && /gdmirror|iqsmartgames/i.test(data.embed_url)) return data.embed_url;
  }
  throw new Error("No GDMirror embed found in MultiMovies players");
}

function sidFrom(url, html) {
  const hidden = String(html).match(/id=["']gdmrfid["'][^>]*value=["']([^"']+)/i)
    || String(html).match(/value=["']([^"']+)["'][^>]*id=["']gdmrfid["']/i);
  if (hidden) return hidden[1];
  const values = [url, ...String(html).matchAll(/https?:\/\/[^"']+\/embed\/([a-z0-9_-]+)/gi)].map(value => value[1] || value);
  for (const value of values) {
    const match = String(value).match(/\/embed\/([a-z0-9_-]+)/i);
    if (match) return match[1];
  }
  throw new Error("GDMirror SID not found");
}

async function resolveSmoothpre(embedUrl, session) {
  let embedResponse = await session.fetch(embedUrl, { headers: { Referer: `${BASE_URL}/` } });
  let html = await responseText(embedResponse, "GDMirror embed");
  let finalUrl = embedResponse.url || embedUrl;
  if (new URL(finalUrl).hostname === "streams.iqsmartgames.com" && /\/embed\/tv\//.test(new URL(finalUrl).pathname)) {
    const value = name => html.match(new RegExp(`let\\s+${name}\\s*=\\s*["']([^"']+)`, "i"))?.[1];
    const id = value("FinalID");
    const idType = value("idType");
    const key = value("myKey");
    const season = value("season");
    const episode = value("epname");
    const playerBase = value("player_base") || "https://pro.iqsmartgames.com";
    const apiBase = value("api_url") || "https://streams.iqsmartgames.com";
    if (!id || !idType || !key || !season || !episode) throw new Error("iqsmartgames TV configuration missing");
    const api = new URL("/myseriesapi", apiBase);
    api.search = new URLSearchParams({ [idType]: id, season, epname: episode, key }).toString();
    const seriesResponse = await session.fetch(api, { headers: { Referer: finalUrl, Accept: "application/json" } });
    if (!seriesResponse.ok) throw new Error(`iqsmartgames series API returned ${seriesResponse.status}`);
    const series = await seriesResponse.json();
    const slug = series.data?.find(item => item?.fileslug)?.fileslug;
    if (!series.success || !slug) throw new Error("iqsmartgames has no file for this episode");
    const evidenceUrl = new URL(`/evid/${encodeURIComponent(slug)}`, playerBase).href;
    embedResponse = await session.fetch(evidenceUrl, { headers: { Referer: finalUrl } });
    html = await responseText(embedResponse, "iqsmartgames episode mirror");
    finalUrl = embedResponse.url || evidenceUrl;
  }
  const sid = sidFrom(finalUrl, html);
  const helperUrl = new URL("/embedhelper2.php", finalUrl).href;
  const helper = await session.fetch(helperUrl, {
    method: "POST",
    body: new URLSearchParams({ sid, UserFavSite: "", "currentDomain[]": "" }),
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Origin: new URL(finalUrl).origin, Referer: finalUrl },
  });
  if (!helper.ok) throw new Error(`GDMirror helper returned ${helper.status}`);
  const data = await helper.json();
  const decoded = JSON.parse(Buffer.from(data.mresult, "base64").toString("utf8"));
  const base = data.sources?.flls?.siteUrl;
  const code = decoded?.flls;
  if (!base || !code) throw new Error("GDMirror has no Smoothpre mirror");
  return { url: new URL(code, base).href, code, sid };
}

module.exports = { episodePageUrl, playerCandidates, resolveDooplay, resolveSmoothpre, sidFrom };
