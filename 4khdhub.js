const cheerio = require("cheerio");

const BASE = "https://4khdhub.one";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const BLOCKED_HOSTS = [
  "4khdhub.one",
  "hdhub4u.download",
  "hdhub4u.",
  "facebook.com",
  "telegram.",
  "twitter.com",
  "x.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "imdb.com",
  "themoviedb.org",
];

function clean(text = "") {
  return text
    .replace(/\s+/g, " ")
    .trim();
}

function absolute(href, base = BASE) {
  if (!href)
    return "";

  try {
    return new URL(href, base).href;
  } catch {
    return "";
  }
}

function normalizeTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function qualityFromText(text = "") {
  return (
    text.match(/2160p|4k|1080p|720p|480p/i)?.[0]
      ?.replace(/^4k$/i, "2160p") || "Auto"
  );
}

function codecFromText(text = "") {
  if (/hdr|dv|dolby vision/i.test(text)) {
    return "HDR";
  }

  if (/hevc|h\.?265|x265/i.test(text)) {
    return "HEVC";
  }

  if (/avc|h\.?264|x264/i.test(text)) {
    return "AVC";
  }

  return "Unknown";
}

function languageFromText(text = "") {
  const langs = [];

  if (/hindi/i.test(text))
    langs.push("Hindi");

  if (/english/i.test(text))
    langs.push("English");

  if (/tamil/i.test(text))
    langs.push("Tamil");

  if (/telugu/i.test(text))
    langs.push("Telugu");

  if (/korean/i.test(text))
    langs.push("Korean");

  return langs.length
    ? langs.join(", ")
    : "Unknown";
}

function isUsefulLink(url) {
  if (!/^https?:\/\//i.test(url))
    return false;

  const lower = url.toLowerCase();


  return !BLOCKED_HOSTS.some(host =>
    lower.includes(host)
  );
}

function isDirectMedia(url = "") {
  try {
    return /\.(?:m3u8|mp4|mkv|webm|avi|mov)$/i.test(
      new URL(url).pathname
    );
  } catch {
    return false;
  }
}

function extractAllLinks(html, pageUrl) {
  const $ = cheerio.load(html);
  const urls = [];

  $("a[href]").each((_, element) => {
    const url = absolute($(element).attr("href"), pageUrl);
    if (url) urls.push(url);
  });

  return [...new Set(urls)];
}

function scoreResult(item, title, year) {
  const target = normalizeTitle(title);
  const found = normalizeTitle(item.title);
  let score = 0;

  if (found === target)
    score += 1000;
  else if (found.includes(target))
    score += 600;
  else if (target.includes(found))
    score += 300;

  if (year && String(item.title).includes(String(year)))
    score += 250;

  if (/2160p|4k/i.test(item.title))
    score += 80;

  if (/1080p/i.test(item.title))
    score += 50;

  return score;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      ...HEADERS,
      Referer: BASE + "/",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });

  return {
    ok: res.ok,
    status: res.status,
    url: res.url,
    html: await res.text(),
  };
}

async function search(title, type = "movie") {
  const urls = [
    `${BASE}/?s=${encodeURIComponent(title)}`,
    `${BASE}/search/${encodeURIComponent(title)}`,
  ];

  const results = [];
  const seen = new Set();

  for (const url of urls) {
    const page = await fetchHtml(url);

    if (!page.ok)
      continue;

    const $ = cheerio.load(page.html);

    $("a[href]").each((_, link) => {
      const href = absolute(
        $(link).attr("href"),
        page.url
      );

      if (!href || !href.startsWith(BASE))
        return;

      if (
        href === BASE + "/" ||
        /\/(page|category|tag|privacy|dmca|contact|about)/i.test(href)
      ) {
        return;
      }

      const text = clean(
        $(link).text() ||
          $(link).attr("title") ||
          ""
      );

      if (!text || text.length < 3)
        return;

      const haystack =
        normalizeTitle(`${text} ${href}`);

      if (!haystack.includes(normalizeTitle(title)))
        return;

      if (type === "tv" && !/series|season|s\d{1,2}/i.test(text + href))
        return;

      if (seen.has(href))
        return;

      seen.add(href);

      results.push({
        title: text,
        url: href,
      });
    });

    if (results.length)
      break;
  }

  return results;
}

function extractLinks(html, pageUrl) {
  const $ = cheerio.load(html);
  const links = [];
  const seen = new Set();

  $("a[href]").each((_, link) => {
    const href = absolute(
      $(link).attr("href"),
      pageUrl
    );

    if (!href || seen.has(href)) {
      return;
    }

    seen.add(href);

    const label = clean(
      $(link).text() ||
      $(link).attr("title") ||
      ""
    );

    // Button container.
    const buttonContainer =
      $(link).parent();

    // Small metadata line directly above buttons.
    const release = clean(
      buttonContainer
        .prevAll()
        .slice(0, 1)
        .text()
    );

    // Larger release block.
    // For TV this contains S01/S02 etc.,
    // filename, size, audio and codec.
    const releaseBlock = clean(
      $(link)
        .parents()
        .eq(2)
        .text()
    );

    const context = clean(
      `${releaseBlock} ${release} ${label}`
    );

    const lower =
      `${href} ${context}`.toLowerCase();

    // Ignore internal navigation/category pages.
    if (
      href.startsWith(BASE) &&
      /\/(?:category|tag|author|page)\//i.test(
        href
      )
    ) {
      return;
    }

    if (
      !/download|drive|gdtot|hubdrive|hubcloud|filepress|pixeldrain|stream|watch|link|mirror|instant|fast|1080|2160|720/i.test(
        lower
      )
    ) {
      return;
    }

    const seasonMatch =
      context.match(
        /\bS(?:eason)?\s*0?(\d{1,2})\b/i
      );

    const episodeMatch =
      context.match(
        /\bE(?:pisode)?\s*0?(\d{1,3})\b/i
      );

    links.push({
      label:
        label || "Link",

      url:
        href,

      context,

      release:
        releaseBlock || release,

      season:
        seasonMatch
          ? Number(seasonMatch[1])
          : null,

      episode:
        episodeMatch
          ? Number(episodeMatch[1])
          : null,
    });
  });

  return links;
}
async function resolveLink(link) {
  const queue = [link.url];
  const visited = new Set();

  while (queue.length && visited.size < 8) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    if (isDirectMedia(url)) {
      return [{
        ...link,
        url,
        proxyHeaders: {
          Referer: new URL(url).origin + "/",
          "User-Agent": HEADERS["User-Agent"],
        },
      }];
    }

    try {
      const page = await fetchHtml(url);
      if (!page.ok) continue;

      for (const next of extractAllLinks(page.html, page.url)) {
        if (isDirectMedia(next)) {
          return [{
            ...link,
            url: next,
            proxyHeaders: {
              Referer: page.url,
              "User-Agent": HEADERS["User-Agent"],
            },
          }];
        }

        if (
          /hubcloud|hubdrive|gamerxyt|filepress|pixeldrain/i.test(next) &&
          !visited.has(next)
        ) {
          queue.push(next);
        }
      }
    } catch {
      // A dead mirror must not prevent the remaining mirrors from resolving.
    }
  }

  return [];
}

async function getStreams({
  title,
  year,
  type = "movie",
  season,
  episode,
}) {
  const results =
    await search(title, type);

  if (!results.length) {
    return [];
  }

  const picked =
    results
      .slice()
      .sort(
        (a, b) =>
          scoreResult(b, title, year) -
          scoreResult(a, title, year)
      )[0];

  const page =
    await fetchHtml(picked.url);

  if (!page.ok) {
    return [];
  }

  let links =
    extractLinks(page.html, page.url);

  const titleMatches = links.filter(link =>
    normalizeTitle(link.release || link.context || "")
      .includes(normalizeTitle(title))
  );
  if (titleMatches.length) links = titleMatches;

  if (type === "tv" && season) {
  const requestedSeason =
    Number(season);

  const requestedEpisode =
    episode
      ? Number(episode)
      : null;

  // First try an exact episode match,
  // in case a page contains individual episodes.
  const episodeMatches =
    requestedEpisode
      ? links.filter(link =>
          link.season === requestedSeason &&
          link.episode === requestedEpisode
        )
      : [];

  if (episodeMatches.length) {
    links =
      episodeMatches;
  } else {
    // 4KHDHub normally provides complete-season ZIP packs.
    // Return only the requested season.
    const seasonMatches =
      links.filter(link =>
        link.season === requestedSeason
      );

    links =
      seasonMatches.map(link => ({
        ...link,

        label:
          `${link.label} — Season ${requestedSeason} Complete`,

        context:
          clean(
            `${link.context} Season ${requestedSeason} Complete`
          ),

        seasonPack:
          true,
      }));
  }
}
  const resolved = (
    await Promise.all(
      links.slice(0, 20).map(resolveLink)
    )
  ).flat();

  const seen = new Set();

  return resolved
    .filter(link => {
      if (!link.url || seen.has(link.url))
        return false;

      seen.add(link.url);

      return true;
    })
    .slice(0, 20)
    .map((link, index) => {
  const text =
  `${link.label} ${link.context} ${link.url}`;

  const direct =
    /\.(m3u8|mp4|mkv)(?:\?|$)/i.test(
      link.url
    );

  const streamType =
    /\.m3u8(?:\?|$)/i.test(link.url)
      ? "M3U8"
      : direct
      ? "Direct"
      : "External";

  return {
    provider: "4KHDHub",

    title:
      link.label || picked.title,

    quality:
      qualityFromText(text),

    codec:
      codecFromText(text),

    audio:
      /aac/i.test(text)
        ? "AAC"
        : /(?:ddp|eac3|dd\+)/i.test(text)
        ? "DDP"
        : /dts/i.test(text)
        ? "DTS"
        : "Unknown",

    language:
      languageFromText(text),

    streamType,

    browserFriendly:
      streamType === "M3U8" ||
      /\.mp4(?:\?|$)/i.test(link.url),

    url:
      link.url,

    sourcePage:
  picked.url,

season:
  link.season || null,

episode:
  link.episode || null,

seasonPack:
  link.seasonPack === true,

    release:
  link.release || link.context || "",

proxyHeaders:
  link.proxyHeaders,

index,
  };
});
}

module.exports = {
  search,
  getStreams,
};
