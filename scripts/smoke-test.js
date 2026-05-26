const { spawn } = require("child_process");

const PORT = "4185";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT,
    NEWS_READER_FIXTURE: "1"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";

server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});

server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${text}`);
  }

  return { response, text };
}

async function main() {
  await wait(500);

  const home = await request("/");

  if (!home.text.includes("News Reader")) {
    throw new Error("home page did not render News Reader");
  }

  const sources = await request("/api/sources");
  const sourcePayload = JSON.parse(sources.text);

  if (!Array.isArray(sourcePayload.sources) || sourcePayload.sources.length < 1) {
    throw new Error("sources endpoint returned no sources");
  }

  const items = await request("/api/items");
  const itemPayload = JSON.parse(items.text);

  if (!Array.isArray(itemPayload.items) || itemPayload.items.length !== 2) {
    throw new Error("fixture feed did not return two items");
  }

  console.log(JSON.stringify({ ok: true, checked: ["home", "sources", "fixture feed"] }, null, 2));
}

main()
  .catch((err) => {
    console.error(output);
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill();
  });
