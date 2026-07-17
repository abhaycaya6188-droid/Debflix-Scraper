/* Remove non-movie/TV categories from existing CTG indexes safely. */
const fs = require("fs");
const path = require("path");
const parser = require("./parser");

const APPLY = process.argv.includes("--apply");
const CACHE_DIR = path.join(__dirname, "cache");

function atomicWrite(file, value) {
    const temporary = `${file}.stream-filter.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
    fs.renameSync(temporary, file);
}

function category(entry) {
    let decoded = entry.path || "";
    try { decoded = decodeURIComponent(decoded); } catch {}
    return decoded.split("/").filter(Boolean).slice(0, 2).join("/");
}

for (let server = 1; server <= 5; server++) {
    const suffix = server === 1 ? "" : String(server);
    const file = path.join(CACHE_DIR, `index${suffix}.json`);
    const index = JSON.parse(fs.readFileSync(file, "utf8"));
    const kept = [];
    const removed = [];

    for (const entry of index) {
        if (parser.isStreamingPath(entry.path || entry.url || "")) kept.push(entry);
        else removed.push(entry);
    }

    const categories = new Map();
    for (const entry of removed) {
        const key = category(entry);
        categories.set(key, (categories.get(key) || 0) + 1);
    }

    if (APPLY && removed.length) {
        const backup = `${file}.pre-stream-filter`;
        if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
        atomicWrite(file, kept);
    }

    console.log(`[CTG-${server}]`, {
        mode: APPLY ? "applied" : "dry-run",
        before: index.length,
        removed: removed.length,
        after: kept.length,
        categories: Object.fromEntries([...categories].sort((a, b) => b[1] - a[1]))
    });
}
