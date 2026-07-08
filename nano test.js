const res = await fetch(
  "https://api.wingsdatabase.com/seed?mediaId=575264",
  {
    headers: {
      "Origin": "https://www.vidking.net",
      "Referer": "https://www.vidking.net/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9"
    }
  }
  
);

console.log("STATUS:", res.status);
console.log(await res.text());
