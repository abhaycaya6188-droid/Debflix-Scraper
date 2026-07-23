'use strict';

const crypto = require('crypto');
const { handleMultiMovies } = require('../provider/multimovies/handler');

const TMDB_API_KEY =
  process.env.TMDB_API_KEY || '7bf6b8cf4d8a661e8a90ae825995471d';
const PROXY_SECRET =
  process.env.MULTIMOVIES_PROXY_SECRET ||
  crypto.createHash('sha256').update(`multimovies:${TMDB_API_KEY}`).digest('hex');

module.exports = async function multimoviesHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const parsed = new URL(req.url, 'http://localhost');
  const query = Object.fromEntries(parsed.searchParams);
  const pathname = query.url
    ? '/api/multimovies-hls-proxy'
    : '/api/multimovies';
  const protocol = String(req.headers['x-forwarded-proto'] || 'https')
    .split(',', 1)[0]
    .trim();
  return handleMultiMovies(req, res, pathname, query, {
    tmdbApiKey: TMDB_API_KEY,
    secret: PROXY_SECRET,
    proxyBase: `${protocol}://${req.headers.host}`,
  });
};
