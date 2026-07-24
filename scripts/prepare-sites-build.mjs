import { cp, mkdir } from "node:fs/promises";
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
await cp(
  resolve(projectRoot, "scripts", "sites-worker.mjs"),
  resolve(server, "index.js")
);
