"use strict";

function unbase(value, radix) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = 0;
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    if (digit < 0 || digit >= radix) return NaN;
    result = result * radix + digit;
  }
  return result;
}

function decodeJsString(value, quote) {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\\") { output += value[index]; continue; }
    const next = value[++index];
    if (next === undefined) { output += "\\"; break; }
    const simple = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" };
    if (simple[next] !== undefined) { output += simple[next]; continue; }
    if (next === "x" && /^[0-9a-f]{2}$/i.test(value.slice(index + 1, index + 3))) {
      output += String.fromCharCode(parseInt(value.slice(index + 1, index + 3), 16)); index += 2; continue;
    }
    if (next === "u" && /^[0-9a-f]{4}$/i.test(value.slice(index + 1, index + 5))) {
      output += String.fromCharCode(parseInt(value.slice(index + 1, index + 5), 16)); index += 4; continue;
    }
    output += next === quote || next === "\\" || next === "'" || next === '"' || next === "/" ? next : `\\${next}`;
  }
  return output;
}

function unpackDeanEdwards(source) {
  const match = String(source).match(/eval\(function\(p,a,c,k,e,(?:d|r)\).*?\}\s*\(\s*(['"])((?:\\.|(?!\1)[\s\S])*)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])((?:\\.|(?!\5)[\s\S])*)\5\.split\(\s*(['"])\|\7\s*\)/);
  if (!match) throw new Error("Smoothpre packed script not found");
  let payload = decodeJsString(match[2], match[1]);
  const radix = Number(match[3]);
  const count = Number(match[4]);
  const words = decodeJsString(match[6], match[5]).split("|");
  if (radix < 2 || radix > 62 || count > 100_000) throw new Error("Unsafe packed script parameters");
  payload = payload.replace(/\b[0-9a-zA-Z]+\b/g, token => {
    const index = unbase(token, radix);
    return Number.isInteger(index) && index < count && words[index] ? words[index] : token;
  });
  return payload;
}

module.exports = { unpackDeanEdwards, unbase };
