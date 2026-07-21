
"use strict";

const moviesmod = require("./index");
const { DEFAULT_HEADERS } = require("./http");

async function metadata(id, type, apiKey) {
  const response = await fetch(
    `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}`,
    {
      signal: AbortSignal.timeout(12_000),
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB returned ${response.status}`);
  }

  const data = await response.json();

  const title =
    type === "tv"
      ? data.name
      : data.title;

  const date =
    type === "tv"
      ? data.first_air_date
      : data.release_date;

  const year = String(date || "").slice(0, 4);

  if (!title) {
    throw new Error("TMDB title missing");
  }

  return {
    title,
    year,
  };
}

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return res.end(JSON.stringify(value));
}

function safeHeader(headers, name) {
  return headers.get(name) || "";
}

async function testR2FromRailway(stream) {
  const headers = {
    ...DEFAULT_HEADERS,
    Accept: "*/*",
    Range: "bytes=0-1023",
    Referer: stream.driveSeedUrl || "https://driveseed.org/",
  };

  const response = await fetch(stream.url, {
    method: "GET",
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });

  const result = {
    streamId: stream.id,
    quality: stream.quality,
    filename: stream.filename,
    driveSeedUrl: stream.driveSeedUrl,
    url: stream.url,

    status: response.status,
    statusText: response.statusText,
    ok: response.ok,

    contentType: safeHeader(response.headers, "content-type"),
    contentLength: safeHeader(response.headers, "content-length"),
    contentRange: safeHeader(response.headers, "content-range"),
    acceptRanges: safeHeader(response.headers, "accept-ranges"),
    location: safeHeader(response.headers, "location"),
    server: safeHeader(response.headers, "server"),
    cfRay: safeHeader(response.headers, "cf-ray"),

    usable:
      response.status === 206 ||
      (
        response.status === 200 &&
        !safeHeader(response.headers, "content-type")
          .toLowerCase()
          .includes("text/html")
      ),
  };

  try {
    await response.body?.cancel();
  } catch {
    // The diagnostic only needs response headers.
  }

  return result;
}

async function resolveRequest(query, options) {
  const id = String(query.id || "");

  const type =
    query.type === "tv"
      ? "tv"
      : "movie";

  if (!/^\d+$/.test(id)) {
    const error = new Error("Invalid TMDB id");
    error.statusCode = 400;
    throw error;
  }

  if (type !== "movie") {
    const error = new Error(
      "MoviesMod TV support is not implemented yet"
    );
    error.statusCode = 400;
    throw error;
  }

  let title = String(query.title || "").trim();
  let year = String(query.year || "").trim();

  if (!title) {
    ({ title, year } = await metadata(
      id,
      type,
      options.tmdbApiKey
    ));
  }

  const result = await moviesmod.getStreams({
    title,
    year,
    type,
  });

  return {
    id,
    type,
    title,
    year,
    result,
  };
}

async function handleMoviesMod(
  req,
  res,
  pathname,
  query,
  options
) {
  const isProvider =
    pathname === "/api/moviesmod";

  const isDiagnostic =
    pathname === "/api/moviesmod-diagnostic";

  if (!isProvider && !isDiagnostic) {
    return false;
  }

  try {
    const resolved = await resolveRequest(
      query,
      options
    );

    if (isDiagnostic) {
      const requestedQuality =
        String(query.quality || "").trim().toLowerCase();

      const streams = requestedQuality
        ? resolved.result.streams.filter(
            (stream) =>
              String(stream.quality || "")
                .toLowerCase() === requestedQuality
          )
        : resolved.result.streams;

      if (!streams.length) {
        return json(res, 404, {
          success: false,
          provider: "MoviesMod",
          error: requestedQuality
            ? `No ${requestedQuality} stream found`
            : "No stream found for diagnostic",
        });
      }

      const diagnostics = [];

      for (const stream of streams) {
        try {
          diagnostics.push(
            await testR2FromRailway(stream)
          );
        } catch (error) {
          diagnostics.push({
            streamId: stream.id,
            quality: stream.quality,
            filename: stream.filename,
            driveSeedUrl: stream.driveSeedUrl,
            url: stream.url,
            status: 0,
            ok: false,
            usable: false,
            error:
              error?.message || String(error),
          });
        }
      }

      return json(res, 200, {
        success: true,
        provider: "MoviesMod",
        diagnostic: true,
        tmdbId: resolved.id,
        title: resolved.result.title,
        year: resolved.result.year,
        postUrl: resolved.result.postUrl,
        tests: diagnostics,
      });
    }

    return json(res, 200, {
      success: true,
      provider: "MoviesMod",
      tmdbId: resolved.id,
      title: resolved.result.title,
      year: resolved.result.year,
      type: resolved.result.type,
      postUrl: resolved.result.postUrl,
      streams: resolved.result.streams,
    });
  } catch (error) {
    return json(
      res,
      error?.statusCode || 502,
      {
        success: false,
        provider: "MoviesMod",
        streams: [],
        error:
          error?.message || String(error),
      }
    );
  }
}

module.exports = {
  handleMoviesMod,
  metadata,
  testR2FromRailway,
};