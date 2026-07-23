"use strict";

const multimovies = require("./index");
const { handleProxy, makeProxyUrl } = require("./proxy");

async function metadata(id, type, apiKey) {
  const response = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`TMDB returned ${response.status}`);
  const data = await response.json();
  const title = type === "tv" ? data.name : data.title;
  const year = String(type === "tv" ? data.first_air_date : data.release_date).slice(0, 4);
  if (!title) throw new Error("TMDB title missing");
  return { title, year };
}

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(value));
}

async function handleMultiMovies(req, res, pathname, query, options) {
  if (pathname === "/api/multimovies-hls-proxy") {
    try { return await handleProxy(req, res, query, options); }
    catch (error) { return json(res, 502, { success: false, provider: "MultiMovies", streams: [], error: error.message }); }
  }
  if (pathname !== "/api/multimovies") return false;
  const id = String(query.id || "");
  const type = query.type === "tv" ? "tv" : "movie";
  if (!/^\d+$/.test(id)) return json(res, 400, { success: false, provider: "MultiMovies", streams: [], error: "Invalid TMDB id" });
  try {
    let title = String(query.title || "").trim();
    let year = String(query.year || "").trim();
    if (!title) ({ title, year } = await metadata(id, type, options.tmdbApiKey));
    const season = type === "tv" ? Number(query.season) : undefined;
    const episode = type === "tv" ? Number(query.episode) : undefined;
    if (type === "tv" && (!Number.isInteger(season) || !Number.isInteger(episode) || season < 1 || episode < 1)) {
      return json(res, 400, { success: false, provider: "MultiMovies", streams: [], error: "Valid season and episode are required" });
    }
    const makeUrl = (target, referer) => makeProxyUrl(options.proxyBase, target, referer, options.secret);
    const streams = await multimovies.getStreams({ title, year, type, season, episode, makeProxyUrl: makeUrl });
    return json(res, 200, { success: true, provider: "MultiMovies", streams });
  } catch (error) {
    return json(res, 502, { success: false, provider: "MultiMovies", streams: [], error: error?.message || String(error) });
  }
}

module.exports = { handleMultiMovies, metadata };
