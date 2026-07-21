
"use strict";

const moviesmod = require("./index");

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

async function handleMoviesMod(
  req,
  res,
  pathname,
  query,
  options
) {
  if (pathname !== "/api/moviesmod") {
    return false;
  }

  const id = String(query.id || "");
  const type =
    query.type === "tv"
      ? "tv"
      : "movie";

  if (!/^\d+$/.test(id)) {
    return json(res, 400, {
      success: false,
      provider: "MoviesMod",
      streams: [],
      error: "Invalid TMDB id",
    });
  }

  if (type !== "movie") {
    return json(res, 400, {
      success: false,
      provider: "MoviesMod",
      streams: [],
      error: "MoviesMod TV support is not implemented yet",
    });
  }

  try {
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

    return json(res, 200, {
      success: true,
      provider: "MoviesMod",
      tmdbId: id,
      title: result.title,
      year: result.year,
      type: result.type,
      postUrl: result.postUrl,
      streams: result.streams,
    });
  } catch (error) {
    return json(res, 502, {
      success: false,
      provider: "MoviesMod",
      streams: [],
      error: error?.message || String(error),
    });
  }
}

module.exports = {
  handleMoviesMod,
  metadata,
};