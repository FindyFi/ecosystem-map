#!/usr/bin/env node
/* Yksinkertainen paikallinen palvelin dist/-kansiolle: http://localhost:8080 */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const DIST = path.resolve(__dirname, "..", "dist"), PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, {"Content-Type": f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream"});
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
