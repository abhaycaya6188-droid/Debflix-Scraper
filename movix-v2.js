const MOVIX_API =
  "https://api.movix.date";

const MOVIX_SITE =
  "https://movix.cash";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",

  Accept:
    "application/json, text/plain, */*",

  Referer:
    `${MOVIX_SITE}/`,

  Origin:
    MOVIX_SITE,
};

function normalizeLink(entry) {
  if (typeof entry === "string") {
    return {
      url: entry,
      addedAt: null,
    };
  }

  if (
    entry &&
    typeof entry === "object" &&
    typeof entry.url === "string"
  ) {
    return {
      url: entry.url,
      addedAt:
        entry.added_at || null,
    };
  }

  return null;
}

function detectHost(url) {
  try {
    const hostname =
      new URL(url).hostname
        .replace(/^www\./, "");

    if (
      hostname.includes("seekplayer")
    ) {
      return "SeekPlayer";
    }

    if (
      hostname.includes("embedseek")
    ) {
      return "EmbedSeek";
    }

    if (
      hostname.includes("bysebuho")
    ) {
      return "Bysebuho";
    }

    if (
      hostname.includes("vidmoly")
    ) {
      return "Vidmoly";
    }

    if (
      hostname.includes("voe.")
    ) {
      return "Voe";
    }

    if (
      hostname.includes("sibnet")
    ) {
      return "Sibnet";
    }

    if (
      hostname.includes("uqload")
    ) {
      return "Uqload";
    }

    return hostname;
  } catch {
    return "Unknown";
  }
}

function detectLanguage(url) {
  const lower =
    String(url).toLowerCase();

  if (
    lower.includes("vostfr")
  ) {
    return "French Sub";
  }

  if (
    lower.includes("vf")
  ) {
    return "French";
  }

  return "French";
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: HEADERS,
    redirect: "follow",
  });

  const text =
    await res.text();

  if (!text.trim()) {
    throw new Error(
      `Movix returned empty body (${res.status})`
    );
  }

  let data;

  try {
    data =
      JSON.parse(text);
  } catch {
    throw new Error(
      `Movix returned non-JSON (${res.status}): ${text.slice(0, 160)}`
    );
  }

  if (!res.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Movix HTTP ${res.status}`
    );
  }

  return data;
}

async function getTvStreams({
  tmdbId,
  season,
  episode,
}) {
  const url =
    `${MOVIX_API}/api/links/tv/${encodeURIComponent(
      tmdbId
    )}` +
    `?season=${encodeURIComponent(
      season
    )}` +
    `&episode=${encodeURIComponent(
      episode
    )}`;

  const payload =
    await fetchJson(url);

  const rows =
    Array.isArray(payload?.data)
      ? payload.data
      : [];

  const rawLinks =
    rows.flatMap(row =>
      Array.isArray(row?.links)
        ? row.links
        : []
    );

  const seen =
    new Set();

  const streams = [];

  for (const entry of rawLinks) {
    const normalized =
      normalizeLink(entry);

    if (
      !normalized?.url ||
      seen.has(normalized.url)
    ) {
      continue;
    }

    seen.add(normalized.url);

    const host =
      detectHost(normalized.url);

    streams.push({
      id:
        `movix-v2-${streams.length}`,

      provider:
        "Movix",

      title:
        `Movix — ${host}`,

      quality:
        "Auto",

      codec:
        "Unknown",

      audio:
        "Unknown",

      language:
        detectLanguage(
          normalized.url
        ),

      host,

      streamType:
        "Embed",

      browserFriendly:
        false,

      url:
        normalized.url,

      addedAt:
        normalized.addedAt,

      type:
        "tv",

      season:
        Number(season),

      episode:
        Number(episode),
    });
  }

  return {
    success:
      streams.length > 0,

    provider:
      "Movix",

    type:
      "tv",

    tmdbId:
      String(tmdbId),

    season:
      Number(season),

    episode:
      Number(episode),

    streams,
  };
}

async function getStreams({
  tmdbId,
  type,
  season,
  episode,
}) {
  if (type !== "tv") {
    return {
      success: false,
      provider: "Movix",
      type,
      tmdbId:
        String(tmdbId),
      error:
        "Movix v2 movie endpoint not added yet",
      streams: [],
    };
  }

  if (!season || !episode) {
    return {
      success: false,
      provider: "Movix",
      type: "tv",
      tmdbId:
        String(tmdbId),
      error:
        "Missing season or episode",
      streams: [],
    };
  }

  return getTvStreams({
    tmdbId,
    season,
    episode,
  });
}

module.exports = {
  getStreams,
};