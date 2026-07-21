
"use strict";

const { fetchText, decodeHtml, stripTags } = require("./http");

function normalizeUrl(value) {
  return decodeHtml(String(value || "").trim());
}

function parseCloudLinks(html) {
  const links = [];
  const seen = new Set();

  const pattern =
    /<a\b[^>]*href=["'](https?:\/\/cloud\.unblockedgames\.world\/\?sid=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = pattern.exec(html))) {
    const url = normalizeUrl(match[1]);
    const label = stripTags(match[2]) || "Cloud Download";

    if (!url || seen.has(url)) continue;

    const useful =
      /fast server|google drive|g-drive|server\s*\d+/i.test(label);

    if (!useful) continue;

    seen.add(url);

    links.push({
      url,
      label,
    });
  }

  return links;
}

function parseUrlFlixLinks(html) {
  const links = [];
  const seen = new Set();

  const pattern =
    /<a\b[^>]*href=["'](https?:\/\/urlflix\.xyz\/gets\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = pattern.exec(html))) {
    const url = normalizeUrl(match[1]);

    if (!url || seen.has(url)) continue;
    seen.add(url);

    links.push({
      url,
      label: stripTags(match[2]) || "Other Download Links",
    });
  }

  return links;
}

async function getModProTargets(modProUrl) {
  const response = await fetchText(modProUrl, {
    headers: {
      Referer: "https://moviesmod.at/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  const cloudLinks = parseCloudLinks(response.text);
  const urlFlixLinks = parseUrlFlixLinks(response.text);

  if (!cloudLinks.length && !urlFlixLinks.length) {
    throw new Error(`No supported download targets found on ${modProUrl}`);
  }

  return {
    modProUrl: response.url,
    cloudLinks,
    urlFlixLinks,
  };
}

module.exports = {
  parseCloudLinks,
  parseUrlFlixLinks,
  getModProTargets,
};
