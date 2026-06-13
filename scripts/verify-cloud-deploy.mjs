import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "archive-server/deploy/render.yaml",
  "archive-server/deploy/railway.json",
  "archive-server/deploy/digitalocean-app.yaml",
];

for (const file of requiredFiles) {
  assert.ok(existsSync(file), `missing deployment template: ${file}`);
}

const read = (file) => readFileSync(file, "utf8");

const readme = read("README.md");
assert.match(readme, /Deploy to Render/i, "README should expose Render one-click deploy");
assert.match(readme, /Deploy on Railway/i, "README should expose Railway one-click deploy");
assert.match(readme, /DigitalOcean App Platform/i, "README should mention DigitalOcean App Platform");

const render = read("archive-server/deploy/render.yaml");
assert.match(render, /archive-suite-server/, "Render template should define the server");
assert.match(render, /archive-suite-frontend/, "Render template should define the frontend");
assert.match(render, /JWT_AUTH_SECRET/, "Render template should declare auth secret");

const railway = read("archive-server/deploy/railway.json");
assert.match(railway, /archive-suite/, "Railway template should name the project");
assert.match(railway, /Dockerfile\.server/, "Railway template should target the server Dockerfile");

const digitalOcean = read("archive-server/deploy/digitalocean-app.yaml");
assert.match(digitalOcean, /archive-suite/, "DigitalOcean spec should name the app");
assert.match(digitalOcean, /Dockerfile\.frontend/, "DigitalOcean spec should include the frontend image");
assert.match(digitalOcean, /Dockerfile\.server/, "DigitalOcean spec should include the server image");

console.log("Cloud deployment templates verified.");
