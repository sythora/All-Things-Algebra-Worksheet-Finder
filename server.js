const express = require("express");
const https = require("https");
const path = require("path");

const app = express(); // idc its bloated but it works
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

function fetch(page, perPage) {
  return new Promise((resolve, reject) => {
    const url = `https://allthingsalgebra.com/wp-json/wp/v2/media?per_page=${perPage}&page=${page}`; // if they screw this up then gg's 
    const options = { headers: { "User-Agent": "Mozilla/5.0" } }; // you can change the user agent but this works

    https.get(url, options, (res) => { // game:httpGet refrence???
      let raw = ""; // yes
      res.on("data", (chunk) => (raw += chunk)); // no clue what this does i think i tsends?
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (e) {
          reject(new Error(`skill issue json on page ${page}`));
        }
      });
    }).on("error", reject);
  });
}

// SSE streaming search endpoint
app.get("/api/search", async (req, res) => {
  const { keyword = "", perPage = 100 } = req.query; // see, im hard coding per 100 page so why is it based on the var?

  if (!keyword.trim()) {
    return res.status(400).json({ error: "keyword is required" });
  }

  res.setHeader("Content-Type", "text/event-stream"); // hopefully we don't get blocked for scraping ts
  res.setHeader("Cache-Control", "no-cache"); // no data stolen*
  res.setHeader("Connection", "keep-alive"); // connection dont die mid json read
// *1 All data sent to sythora llc then sold to china!
  const send = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  let page = 1; // yes while(true) time, lets hope I dont screw this up!1
  let totalscanned = 0;
  let totalfound = 0;

  try {
    while (true) {
      send("status", { message: `Fetching page ${page}...` });

      const { status, data } = await fetch(page, Math.min(parseInt(perPage) || 100, 100));

      if (status === 400 || !Array.isArray(data) || data.length === 0) {
        send("done", { pages: page - 1, scanned: totalscanned, found: totalfound });
        break; // see its done!! 
      }

      totalscanned += data.length; // why don't I juse push data.length instead of ts, such a inaccuracy

      for (const item of data) {
        const url = item.source_url || "";
        if (url.toLowerCase().includes(keyword.toLowerCase())) {
          totalfound++;
          send("match", { page, url });
        }
      }

      send("progress", { page, scanned: totalscanned, found: totalfound });

      if (data.length < parseInt(perPage)) {
        send("done", { pages: page, scanned: totalscanned, found: totalfound });
        break;
      }

      page++;
    }
  } catch (err) {
    send("error", { message: err.message });
  }

  res.end();
});

app.listen(PORT, () => {
  console.log(`cheats running at http://localhost:${PORT}`);
});