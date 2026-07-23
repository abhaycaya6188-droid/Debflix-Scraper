const parser = require("./parser");

const filename =
"ARJUN SURAVARAM (2019) Telugu TRUE HDRip - 720p - x264 - AAC - ESub [DDN].mp4";

const meta = parser.parse(
    filename,
    filename
);

console.log("META:");
console.log(meta);

console.log("");

console.log(
    "VALID:",
    parser.validate(meta)
);