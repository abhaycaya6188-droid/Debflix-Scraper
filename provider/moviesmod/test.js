
"use strict";

const { getStreams } = require("./index");

const title = process.argv[2] || "Interstellar";
const year = process.argv[3] || "2014";

(async () => {
  console.log(`[MoviesMod] Testing ${title} (${year})`);

  const result = await getStreams({
    title,
    year,
    type: "movie",
  });

  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error("[MoviesMod] Failed:", error);
  process.exit(1);
});
