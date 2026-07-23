"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { parseResults, rankResult } = require("./search");
const { extractLinks } = require("./smoothpre");
const { unpackDeanEdwards } = require("./unpack");
const { allowedHost, rewritePlaylist, sign } = require("./proxy");
const { episodePageUrl } = require("./gdmirror");

test("search parser strictly favors matching movie title and year", () => {
  const html = `<article><h2><a href="/movies/interstellar/">Interstellar</a></h2><span>2014</span></article>
    <article><h2><a href="/movies/interstellar-wars/">Interstellar Wars</a></h2><span>2016</span></article>`;
  const results = parseResults(html);
  assert.equal(results.length, 2);
  assert.equal(rankResult(results[0], { title: "Interstellar", year: "2014", type: "movie" }), 150);
  assert.ok(rankResult(results[1], { title: "Interstellar", year: "2014", type: "movie" }) < 70);
});

test("Dean Edwards unpacking and hls3 priority data extraction", () => {
  const packed = `eval(function(p,a,c,k,e,d){return p}('0 1={2:"https://cdn.example/master.txt",3:"fallback"};',4,4,'var|links|hls3|hls2'.split('|'),0,{}))`;
  const unpacked = unpackDeanEdwards(packed);
  assert.deepEqual(extractLinks(unpacked), { hls3: "https://cdn.example/master.txt", hls2: "fallback" });
});

test("proxy accepts disguised playlists/segments and rewrites relative URLs", () => {
  assert.equal(allowedHost("video.onlineartacademy.site"), true);
  assert.equal(allowedHost("evil-onlineartacademy.site.example"), false);
  const secret = "test-secret";
  const output = rewritePlaylist(
    '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/index.txt"\nindex-f3-v1-a1.txt',
    "https://video.onlineartacademy.site/path/master.txt?token=one",
    "https://smoothpre.com/v/code",
    "https://oracle.example",
    secret
  );
  assert.match(output, /audio%2Findex\.txt/);
  assert.match(output, /index-f3-v1-a1\.txt/);
  assert.match(output, new RegExp(sign("https://video.onlineartacademy.site/path/index-f3-v1-a1.txt", "https://smoothpre.com/v/code", secret)));
});

test("TV series pages resolve the exact season and episode", () => {
  const html = `<a href="/episodes/show-1x1/">Pilot</a><a href="/episodes/show-1x10/">Finale</a>`;
  assert.equal(
    episodePageUrl(html, 1, 1, "https://multimovies.study/tvshows/show/"),
    "https://multimovies.study/episodes/show-1x1/"
  );
  assert.throws(() => episodePageUrl(html, 2, 1, "https://multimovies.study/tvshows/show/"));
});
