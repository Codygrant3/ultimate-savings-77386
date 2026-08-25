import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const output = resolve(projectRoot, "dist");
const client = resolve(output, "client");
const server = resolve(output, "server");

await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });
await cp(resolve(output, "index.html"), resolve(client, "index.html"));
await cp(resolve(output, "assets"), resolve(client, "assets"), {
  recursive: true
});
await cp(resolve(output, "favicon.svg"), resolve(client, "favicon.svg"));
await cp(resolve(output, "robots.txt"), resolve(client, "robots.txt"));
await cp(resolve(output, "llms.txt"), resolve(client, "llms.txt"));
await cp(resolve(output, "sitemap.xml"), resolve(client, "sitemap.xml"));
await cp(resolve(output, "reports"), resolve(client, "reports"), {
  recursive: true
});

const indexHtml = await readFile(resolve(output, "index.html"), "utf8");
const assetMatch = indexHtml.match(/\/assets\/(index-[^"']+\.js)/);
if (!assetMatch) {
  throw new Error("Unable to identify the production JavaScript asset.");
}

const workerTemplate = await readFile(
  resolve(projectRoot, "scripts", "sites-worker.mjs"),
  "utf8"
);
if (!workerTemplate.includes("__ASSET_REVISION__")) {
  throw new Error("Sites worker is missing the asset revision placeholder.");
}

await writeFile(
  resolve(server, "index.js"),
  workerTemplate.replaceAll("__ASSET_REVISION__", assetMatch[1])
);
