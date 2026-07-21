const DEFAULT_TIMEOUT_MS = 20_000;

const DEFAULT_HEADERS = {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    origin: "https://hdghartv.cc",
    referer: "https://hdghartv.cc/",
    "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/149.0.0.0 Safari/537.36",
};

function createTimeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    return {
        signal: controller.signal,
        clear() {
            clearTimeout(timeout);
        },
    };
}

async function request(url, options = {}) {
    const {
        method = "GET",
        headers = {},
        body,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        redirect = "follow",
    } = options;

    const timeout = createTimeoutSignal(timeoutMs);

    try {
        const response = await fetch(url, {
            method,
            headers: {
                ...DEFAULT_HEADERS,
                ...headers,
            },
            body,
            redirect,
            signal: timeout.signal,
        });

        return response;
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new Error(`HDGharTV request timed out: ${url}`);
        }

        throw new Error(
            `HDGharTV request failed: ${url} — ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    } finally {
        timeout.clear();
    }
}

async function getText(url, options = {}) {
    const response = await request(url, options);
    const text = await response.text();

    if (!response.ok) {
        throw new Error(
            `HDGharTV HTTP ${response.status} ${response.statusText}: ${text.slice(
                0,
                300
            )}`
        );
    }

    return {
        response,
        text,
    };
}

async function getJson(url, options = {}) {
    const { response, text } = await getText(url, options);

    try {
        return {
            response,
            data: JSON.parse(text),
        };
    } catch {
        throw new Error(
            `HDGharTV returned invalid JSON from ${url}: ${text.slice(0, 300)}`
        );
    }
}

module.exports = {
    DEFAULT_HEADERS,
    DEFAULT_TIMEOUT_MS,
    request,
    getText,
    getJson,
};