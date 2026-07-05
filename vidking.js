const fetch = global.fetch;

const API = "https://api.wingsdatabase.com";

// ===== VidKing decrypt constants =====

const jl = [
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580
];

const Tf = [
    1732584193,
    4023233417,
    2562383102,
    271733878
];

const Js = 61;
const _f = 8;
const ms = 2654435769;

const Ys = [
    109,
    118,
    109,
    49
];

function Sf(v) {
    return (v * (v + 1) & 1) === 0;
}

function bf(v) {
    return (v * (v + 1) & 1) === 1;
}

const PROVIDERS = [
    "cdn",
    "tejo",
    "neon2",
    "downloader2",
    "1movies"
];

async function getSeed(tmdbId) {
    const res = await fetch(`${API}/seed?mediaId=${tmdbId}`, {
  headers: {
    "Origin": "https://www.vidking.net",
    "Referer": "https://www.vidking.net/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9"
  }
});
    if (!res.ok) {
        throw new Error(`Seed HTTP ${res.status}`);
    }

    const json = await res.json();

    if (!json.seed) {
        throw new Error("Seed missing");
    }

    return json.seed;
}

async function fetchEncrypted(provider, params) {
    
const seed =
    params.seed || await getSeed(params.tmdbId);

    const query = new URLSearchParams({
        title: params.title || "",
        mediaType: params.mediaType || "movie",
        year: params.year || "",
        tmdbId: String(params.tmdbId),
        imdbId: params.imdbId || "",
        seasonId: String(params.seasonId || 1),
        episodeId: String(params.episodeId || 1),
        enc: "2",
        seed,
        _t: Date.now().toString()
    });

    const url =
        `${API}/${provider}/sources-with-title?${query}`;

    console.log("VIDKING URL:");
    console.log(url);

    const res = await fetch(url, {
    headers: {
        "Origin": "https://www.vidking.net",
        "Referer": "https://www.vidking.net/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9"
    }
});

const text = await res.text();

if (!res.ok) {

    return {

        debug: true,

        provider,

        status: res.status,

        url,

        body: text.substring(0, 500)

    };

}

    return {
        seed,
        encrypted: text
    };
}

// ===== VidKing Crypto Helpers =====

function ui(l) {
    l >>>= 0;
    l ^= l >>> 16;
    l = Math.imul(l, 2246822507) >>> 0;
    l ^= l >>> 13;
    l = Math.imul(l, 3266489909) >>> 0;
    l ^= l >>> 16;
    return l >>> 0;
}

function ps(l, o) {
    l >>>= 0;
    o &= 31;

    return o === 0
        ? l >>> 0
        : ((l << o) | (l >>> (32 - o))) >>> 0;
}

function If(seed) {

    let hash = Tf[0] >>> 0;

    for (let i = 0; i < seed.length; i++) {

        hash = ps(
            (
                hash ^
                Math.imul(
                    seed.charCodeAt(i),
                    jl[i & 15]
                )
            ) >>> 0,
            5
        );

    }

    return ui(hash);

}

function Af(seed) {

    const S = new Array(256);

    for (let i = 0; i < 256; i++) {
        S[i] = i;
    }

    let j = 0;

    for (let i = 0; i < 256; i++) {

        j =
            (
                j +
                S[i] +
                seed.charCodeAt(i % seed.length)
            ) &
            255;

        const t = S[i];

        S[i] = S[j];

        S[j] = t;

    }

    return S;

}

function wf(seed) {

    let hash = 2166136261;

    for (let i = 0; i < seed.length; i++) {

        hash =
            Math.imul(
                hash ^
                seed.charCodeAt(i),
                16777619
            ) >>> 0;

    }

    return ui(hash);

}

function vf(a, b, c) {

    return (
        (
            (a ^ b) >>> 0 |
            ((a & b & c) >>> 0)
        ) >>> 0
    );

}

// ===== VidKing PRNG =====

function Nf(seed, tmdbId) {

    if (bf(seed.length)) {

        return {
            S: Af(seed),
            acc: If(seed)
        };

    }

    const S = new Array(Js);

    let acc =
        ui(
            wf(seed) ^
            ui((tmdbId >>> 0) ^ ms)
        ) >>> 0;

    for (let i = 0; i < _f; i++) {

        if (Sf(i)) {

            const idx = acc % Js;

            acc =
                ps(
                    (acc + ms) >>> 0,
                    7 + (i & 7)
                );

            S[idx] =
                (acc ^ ui(acc)) >>> 0;

            acc =
                ui(
                    (acc + idx) >>> 0
                );

        } else {

            S[i] = jl[i & 15];

        }

    }

    return {
        S,
        acc:
            ui(acc ^ 2779096485) >>> 0
    };

}

function Rf(state, counter) {

    const S = state.S;

    let acc = state.acc;

    const idx = acc % Js;

    const exists = -(+(idx in S));

    const value = S[idx] >>> 0;

    const mix =
        Math.imul(
            ms,
            counter + 1
        ) >>> 0;

    let x =
        vf(
            acc,
            (value ^ mix) >>> 0,
            exists
        );

    x =
        (
            ps(
                (x + acc) >>> 0,
                idx & 31
            ) ^
            ps(
                acc,
                Math.imul(idx, 7) & 31
            )
        ) >>> 0;

    acc =
        ui(
            (x + ms) >>> 0
        );

    S[idx] = acc >>> 0;

    state.acc = acc;

    return acc >>> 0;

}

function Cf(seed, tmdbId, length) {

    const state =
        Nf(seed, tmdbId);

    const out =
        new Uint8Array(length);

    let counter = 0;

    for (let i = 0; i < length;) {

        const word =
            Rf(state, counter++);

        out[i++] = word & 255;

        if (i < length)
            out[i++] =
                (word >>> 8) & 255;

        if (i < length)
            out[i++] =
                (word >>> 16) & 255;

        if (i < length)
            out[i++] =
                (word >>> 24) & 255;

    }

    return out;

}

// ===== VidKing Decrypt =====

function xf(data) {

    const b64 =
        data
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(
                Math.ceil(data.length / 4) * 4,
                "="
            );

    return Uint8Array.from(
        Buffer.from(b64, "base64")
    );

}

function Df(encrypted, seed, tmdbId) {

    const bytes = xf(encrypted);

    const stream =
        Cf(
            seed,
            tmdbId,
            bytes.length
        );

    for (let i = 0; i < bytes.length; i++) {
        bytes[i] ^= stream[i];
    }

    for (let i = 0; i < Ys.length; i++) {

        if (bytes[i] !== Ys[i]) {

            throw new Error(
                "Decrypt failed (bad seed)"
            );

        }

    }

    return new TextDecoder()
        .decode(
            bytes.subarray(
                Ys.length
            )
        );

}

async function resolve(params) {

    const seed =
        await getSeed(params.tmdbId);

    const result =
        await fetchEncrypted(
            "cdn",
            {
                ...params,
                seed
            }
        );

    const json =
        Df(
            result.encrypted,
            seed,
            Number(params.tmdbId)
        );

    return JSON.parse(json);

}

module.exports = {
    API,
    PROVIDERS,
    getSeed,
    fetchEncrypted,
    resolve,
    Df,
    Cf
};