const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36"
};

function extractCsrf(html = "") {
    return html.match(
        /<input[^>]+name=["']csrf_test_name["'][^>]+value=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
        /<input[^>]+value=["']([^"']+)["'][^>]+name=["']csrf_test_name["']/i
    )?.[1] ||
    html.match(
        /<meta[^>]+name=["'](?:X-CSRF-TOKEN|csrf-token)["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["'](?:X-CSRF-TOKEN|csrf-token)["']/i
    )?.[1] || "";
}

function cookieHeader(response, existing = "") {
    const values = typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie")].filter(Boolean);

    const jar = new Map();
    existing.split("; ").filter(Boolean).forEach(value => {
        const [name] = value.split("=", 1);
        jar.set(name, value);
    });
    values.forEach(value => {
        const pair = value.split(";")[0];
        const [name] = pair.split("=", 1);
        if (name) jar.set(name, pair);
    });
    return [...jar.values()].join("; ");
}

function googleVideoUrl(text = "") {
    const decoded = text
        .replace(/&amp;/g, "&")
        .replace(/&#0*38;/g, "&");

    const google = decoded.match(
        /https:\/\/video-downloads\.googleusercontent\.com[^"'<> ]+/i
    )?.[0];

    const hrefMedia = decoded.match(
        /href=["'](https?:\/\/[^"']+\.(?:mkv|mp4|webm|avi)(?:\?[^"']*)?)["']/i
    )?.[1];

    const directMedia = decoded.match(
        /https?:\/\/[^"'<> ]+\.(?:mkv|mp4|webm|avi)(?:\?[^"'<> ]*)?/i
    )?.[0];

    return google || hrefMedia || directMedia || "";
}

async function resolve(url) {

    console.log("[CINECLOUD]", url);

    const res = await fetch(url, {
        headers: HEADERS,
        redirect: "manual"
    });

    const html = await res.text();
const iframe =
    html.match(/<iframe[^>]+src="([^"]+)"/i);

if (!iframe) {
return {
    success: false,
    error: "Iframe not found"
};

}

const iframeUrl =
    iframe[1].replace(/&amp;/g, "&");

const r2 =
    decodeURIComponent(
        iframeUrl.match(/id=([^&]+)/)?.[1] || ""
    );

const subtitle =
    decodeURIComponent(
        iframeUrl.match(/sub%5B0%5D=([^&]+)/)?.[1] || ""
    );

return {

    success: true,

    stream: r2,

    subtitles: subtitle,

    iframe: iframeUrl

};

}



async function generate(downloadUrl) {

    // ---------- STEP 1 : GET page ----------

    let getRes;

try {
    getRes = await fetch(
        downloadUrl.replace("/w/", "/d/"),
        {
            headers: HEADERS
        }
    );
} catch (e) {
    console.error("❌ FAILED: GET /d/");
    throw e;
}

    const html = await getRes.text();

    let cookies = cookieHeader(getRes);
    const csrf = extractCsrf(html);

    if (!csrf) {
        return {
            success: false,
            error: "No CSRF"
        };
    }

    console.log("[CINECLOUD] Starting generation...");
    const getUrl = downloadUrl.replace("/w/", "/d/");
    const origin = new URL(downloadUrl).origin;

    // ---------- STEP 2 : START GENERATION ----------

    let started = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const postRes = await fetch(downloadUrl, {
                method: "POST",
                headers: {
                    ...HEADERS,
                    Cookie: cookies,
                    Referer: getUrl,
                    Origin: origin,
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN": csrf,
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    Accept: "application/json, text/javascript, */*; q=0.01"
                },
                body: new URLSearchParams({ csrf_test_name: csrf })
            });

            const postBody = await postRes.text();
            cookies = cookieHeader(postRes, cookies);
            console.log("POST STATUS:", postRes.status);

            const immediate = googleVideoUrl(postBody);
            if (immediate) return { success: true, stream: immediate };

            if (postRes.ok) {
                started = true;
                break;
            }

            if (postRes.status < 500 || attempt === 3) {
                return {
                    success: false,
                    error: `Generation HTTP ${postRes.status}`
                };
            }
        } catch (e) {
            if (attempt === 3) throw e;
        }

        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }

    if (!started) {
        return { success: false, error: "Generation did not start" };
    }
    // ---------- STEP 3 : POLL ----------

    for (let i = 1; i <= 30; i++) {

        

        await new Promise(r => setTimeout(r, 2000));

        let res;

try {

    res = await fetch(getUrl, {
        headers: {
            ...HEADERS,
            Cookie: cookies,
            Referer: getUrl
        }
    });

} catch (e) {
    console.error(`❌ FAILED: POLL ${i}`);
    throw e;
}
        const page = await res.text();

        const stream = googleVideoUrl(page);

        if (stream) {

    console.log("[CINECLOUD] SUCCESS");

    return {
        success: true,
        stream
    };

}


    }

    return {
        success: false,
        error: "Timed out waiting for Instant Download"
    };

}
module.exports = {
    resolve,
    generate
};
