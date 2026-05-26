const DEFAULT_PORT = process.env.PORT || "4175";
const BASE_URL = (process.env.NEWS_READER_BASE_URL || `http://127.0.0.1:${DEFAULT_PORT}`).replace(/\/+$/, "");

const COMMANDS = {
  status: { method: "GET", path: "/api/life-graph/status" },
  "local-dry-run": { method: "POST", path: "/api/life-graph/import/dry-run" },
  "remote-dry-run": { method: "POST", path: "/api/life-graph/import/remote-dry-run" },
  apply: { method: "POST", path: "/api/life-graph/import/apply" },
  sources: { method: "GET", path: "/api/life-graph/intel/sources" },
  works: { method: "GET", path: "/api/life-graph/intel/works" }
};

async function main() {
  const command = process.argv[2] || "status";
  const config = COMMANDS[command];

  if (!config) {
    throw new Error(`Unknown command "${command}". Valid commands: ${Object.keys(COMMANDS).join(", ")}`);
  }

  const response = await fetch(`${BASE_URL}${config.path}`, { method: config.method });
  const payload = await response.json();

  console.log(JSON.stringify(payload, null, 2));

  if (!response.ok || payload.ok === false) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
