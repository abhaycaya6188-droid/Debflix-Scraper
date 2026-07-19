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

async function resolveDooplay(pageUrl, options, session) {
  const pageResponse = await session.fetch(pageUrl, { headers: { Referer: `${BASE_URL}/` } });
  const html = await responseText(pageResponse, "MultiMovies title page");
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
  const embedResponse = await session.fetch(embedUrl, { headers: { Referer: `${BASE_URL}/` } });
  const html = await responseText(embedResponse, "GDMirror embed");
  const finalUrl = embedResponse.url || embedUrl;
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

module.exports = { playerCandidates, resolveDooplay, resolveSmoothpre, sidFrom };
