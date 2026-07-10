/* ============================================================
   CTG Matcher
============================================================ */

function normalize(text) {

    return String(text || "")

        .toLowerCase()

        .replace(/[._-]/g, " ")

        .replace(/\s+/g, " ")

        .replace(/[^\w\s]/g, "")

        .trim();

}

function score(entry, query) {

    let score = 0;

    const wanted = normalize(query.title);

    const normalized =
        entry.normalizedTitle || normalize(entry.title);

    if (normalized === wanted)
        score += 1000;

    else if (normalized.startsWith(wanted))
        score += 800;

    else if (normalized.includes(wanted))
        score += 600;

    const words =
        wanted.split(" ");

    let matched = 0;

    for (const word of words) {

        if (normalized.includes(word))
            matched++;

    }

    score += matched * 50;

    if (
        query.year &&
        entry.year &&
        query.year === entry.year
    ) {
        score += 200;
    }

    if (entry.quality === "2160p")
        score += 40;

    else if (entry.quality === "1080p")
        score += 30;

    else if (entry.quality === "720p")
        score += 20;

    if (entry.codec === "HEVC")
        score += 10;

    if (entry.hdr)
        score += 10;

    return score;

}

function search(engine, query) {

    const results = [];

    const wanted = normalize(query.title);

let candidates = null;

/* TV lookup */
if (
    query.type === "tv" &&
    query.season != null &&
    query.episode != null &&
    engine.tvMap
) {

    const key =
        `${wanted}|${Number(query.season)}|${Number(query.episode)}`;
        console.log("[SEARCH]", key);

    if (engine.tvMap.has(key)) {

        candidates =
            engine.tvMap.get(key);

    }

}

/* Movie lookup */
if (
    !candidates &&
    engine.movieMap &&
    engine.movieMap.has(wanted)
) {

    candidates =
        engine.movieMap.get(wanted);

}

/* Fallback */
if (!candidates) {

    candidates =
        engine.index;

}

    for (const entry of candidates) {

        const s =
            score(entry, query);

        if (s < 1000)
            continue;

        results.push({

            ...entry,

            score: s

        });

    }

    results.sort((a, b) => b.score - a.score);

return results.slice(0, 25);

}

module.exports = {

    search,

    normalize,

    score

};