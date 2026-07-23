
"use strict";

const { fetchText, decodeHtml, stripTags } = require("./http");

const DRIVESEED_ORIGIN = "https://driveseed.org";

function extractJsRedirect(html) {
  const match = String(html || "").match(
    /window\.location\.replace\(\s*["']([^"']+)["']\s*\)/i
  );

  if (!match) return "";

  return new URL(decodeHtml(match[1]), DRIVESEED_ORIGIN).toString();
}

function extractTitle(html) {
  const match = String(html || "").match(/<title>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : "";
}

function extractMetaDescription(html) {
  const match = String(html || "").match(
    /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
  );

  return match ? decodeHtml(match[1]).trim() : "";
}

function extractFileInfo(html) {
  const title = extractTitle(html);
  const description = extractMetaDescription(html);
  const source = String(html || "");

  const nameMatch = source.match(
    /<li\b[^>]*>\s*Name\s*:\s*([^<]+)<\/li>/i
  );

  const formatMatch = source.match(
    /<li\b[^>]*>\s*Format\s*:\s*([^<]+)<\/li>/i
  );

  const sizeMatch = source.match(
    /<li\b[^>]*>\s*Size\s*:\s*(\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB))\s*<\/li>/i
  );

  const descriptionSizeMatch = description.match(
    /\b(\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB))\b/i
  );

  const filename = nameMatch
    ? stripTags(nameMatch[1])
    : title;

  const extensionMatch = filename.match(/\.([a-z0-9]{2,5})$/i);

  return {
    filename,
    format: formatMatch
      ? stripTags(formatMatch[1]).toUpperCase()
      : extensionMatch
        ? extensionMatch[1].toUpperCase()
        : "",
    size: sizeMatch
      ? sizeMatch[1].replace(/\s+/g, "")
      : descriptionSizeMatch
        ? descriptionSizeMatch[1].replace(/\s+/g, "")
        : "",
    description,
  };
}

function extractCloudDownload(html) {
  const anchorPattern =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = anchorPattern.exec(String(html || "")))) {
    const url = decodeHtml(match[1]).trim();
    const label = stripTags(match[2]);

    if (!/cloud download/i.test(label)) continue;
    if (!/^https?:\/\//i.test(url)) continue;

    return {
      url,
      label,
    };
  }

  return null;
}

function extractInstantDownloads(html) {
  const results = [];
  const seen = new Set();

  const anchorPattern =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = anchorPattern.exec(String(html || "")))) {
    const url = decodeHtml(match[1]).trim();
    const label = stripTags(match[2]);

    if (!/instant download/i.test(label)) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;

    seen.add(url);

    results.push({
      url,
      label,
    });
  }

  return results;
}

async function getDriveSeedFilePage(driveSeedRedirectUrl) {
  const redirectResponse = await fetchText(driveSeedRedirectUrl, {
    headers: {
      Referer: "https://cloud.unblockedgames.world/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  const filePageUrl = extractJsRedirect(redirectResponse.text);

  if (!filePageUrl) {
    throw new Error("DriveSeed file-page redirect missing");
  }

  const fileResponse = await fetchText(filePageUrl, {
    headers: {
      Referer: `${DRIVESEED_ORIGIN}/`,
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Upgrade-Insecure-Requests": "1",
    },
  });

  const fileInfo = extractFileInfo(fileResponse.text);
  const cloudDownload = extractCloudDownload(fileResponse.text);
  const instantDownloads = extractInstantDownloads(fileResponse.text);

  const primaryDownload = cloudDownload || null;

  if (!primaryDownload?.url) {
    throw new Error("DriveSeed direct Cloud Download link missing");
  }

  return {
    driveSeedRedirectUrl,
    filePageUrl: fileResponse.url,
    ...fileInfo,
    cloudDownload,
    instantDownloads,
    primaryDownload,
  };
}

module.exports = {
  extractJsRedirect,
  extractTitle,
  extractMetaDescription,
  extractFileInfo,
  extractCloudDownload,
  extractInstantDownloads,
  getDriveSeedFilePage,
};