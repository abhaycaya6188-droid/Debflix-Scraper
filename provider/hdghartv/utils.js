function normalizeText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getYear(item) {
    const date =
        item?.releaseDate ||
        item?.firstAirDate ||
        item?.year ||
        "";

    const match = String(date).match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
}

function getTmdbId(item) {
    const value =
        item?.tmdbId ??
        item?.tmdb_id ??
        item?.tmdbID ??
        null;

    if (value === null || value === undefined || value === "") {
        return null;
    }

    return String(value);
}

function scoreCandidate(item, target = {}) {
    const wantedTmdbId = String(target.tmdbId || "");
    const candidateTmdbId = getTmdbId(item);

    if (
        wantedTmdbId &&
        candidateTmdbId &&
        wantedTmdbId === candidateTmdbId
    ) {
        return 100000;
    }

    const wantedTitle = normalizeText(target.title);
    const candidateTitle = normalizeText(
        item?.title || item?.originalTitle
    );

    if (!wantedTitle || !candidateTitle) {
        return -1;
    }

    let score = 0;

    if (candidateTitle === wantedTitle) {
        score += 1000;
    } else if (
        candidateTitle.startsWith(wantedTitle) ||
        wantedTitle.startsWith(candidateTitle)
    ) {
        score += 700;
    } else if (
        candidateTitle.includes(wantedTitle) ||
        wantedTitle.includes(candidateTitle)
    ) {
        score += 500;
    } else {
        const wantedWords = wantedTitle.split(" ");
        const candidateWords = new Set(candidateTitle.split(" "));

        for (const word of wantedWords) {
            if (word.length > 1 && candidateWords.has(word)) {
                score += 60;
            }
        }
    }

    const wantedYear = Number(target.year || 0);
    const candidateYear = getYear(item);

    if (wantedYear && candidateYear) {
        if (wantedYear === candidateYear) {
            score += 250;
        } else if (Math.abs(wantedYear - candidateYear) === 1) {
            score += 50;
        } else {
            score -= 100;
        }
    }

    return score;
}

function selectBestCandidate(items, target) {
    let best = null;
    let bestScore = -1;

    for (const item of items || []) {
        const score = scoreCandidate(item, target);

        if (score > bestScore) {
            best = item;
            bestScore = score;
        }
    }

    return {
        item: best,
        score: bestScore,
    };
}

function uniqueByInternalId(items) {
    const seen = new Set();
    const results = [];

    for (const item of items || []) {
        const id = String(item?._id || item?.id || "");

        if (!id || seen.has(id)) {
            continue;
        }

        seen.add(id);
        results.push(item);
    }

    return results;
}

module.exports = {
    normalizeText,
    getYear,
    getTmdbId,
    scoreCandidate,
    selectBestCandidate,
    uniqueByInternalId,
};