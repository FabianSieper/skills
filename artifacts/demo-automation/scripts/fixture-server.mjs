import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const html = await readFile(
  new URL("../fixtures/inventory.html", import.meta.url),
);
const port = Number(process.argv[2] ?? 4173);
if (!Number.isSafeInteger(port) || port < 0 || port > 65535)
  throw new Error("Invalid port");
const server = createServer((req, res) => {
  if (req.url !== "/") {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
server.listen(port, "127.0.0.1", () =>
  console.log(JSON.stringify({ ok: true, port: server.address().port })),
);
process.on("SIGTERM", () => server.close());
