"use strict";

const { USER_AGENT, responseText } = require("./http");
const { unpackDeanEdwards } = require("./unpack");

function extractLinks(script) {
  const block = script.match(/(?:var|let|const)\s+links\s*=\s*\{([\s\S]*?)\}\s*;?/)?.[1];
  if (!block) throw new Error("Smoothpre links object not found");
  const links = {};
  for (const match of block.matchAll(/(?:["'])?\b(hls[234])(?:["'])?\s*:\s*(['"])(.*?)\2/g)) links[match[1]] = match[3].replace(/\\\//g, "/");
  return links;
}

async function extractSmoothpre(smoothpreUrl, session) {
  const origin = new URL(smoothpreUrl).origin;
  const response = await session.fetch(smoothpreUrl, {
    headers: { Accept: "text/html,application/xhtml+xml", Referer: "https://pro.iqsmartgames.com/" },
  });
  const html = await responseText(response, "Smoothpre embed");
  const packedScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).filter(script => /eval\s*\(\s*function\s*\(p,a,c,k,e,/i.test(script));
  let links = {};
  for (const packed of packedScripts.length ? packedScripts : [html]) {
    try {
      const candidate = extractLinks(unpackDeanEdwards(packed));
      if (candidate.hls3 || candidate.hls2 || candidate.hls4) { links = candidate; break; }
    } catch { /* Try the next independently packed block. */ }
  }
  const key = ["hls3", "hls2", "hls4"].find(name => links[name]);
  if (!key) throw new Error("Smoothpre has no supported HLS stream");
  return {
    url: new URL(links[key], response.url || smoothpreUrl).href,
    selected: key,
    referer: smoothpreUrl,
    headers: { "User-Agent": USER_AGENT, Referer: smoothpreUrl, Origin: origin },
  };
}

module.exports = { extractLinks, extractSmoothpre };
