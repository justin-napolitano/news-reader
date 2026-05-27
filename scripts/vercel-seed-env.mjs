import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_ENV_FILE = ".env.vercel.production";

function parseArgs(argv) {
  const args = {
    envFile: DEFAULT_ENV_FILE,
    force: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--env-file") args.envFile = argv[++index] || DEFAULT_ENV_FILE;
    else if (arg === "--force") args.force = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/vercel-seed-env.mjs

Options:
  --env-file <path>  Env file to create/update. Default: ${DEFAULT_ENV_FILE}
  --force            Regenerate generated values even when already set.`);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return new Map();
  }

  const values = new Map();
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) {
      continue;
    }

    const index = line.indexOf("=");
    values.set(line.slice(0, index).trim(), line.slice(index + 1));
  }

  return values;
}

function randomSecret(bytes) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function seed(values, key, value, { force = false } = {}) {
  const hadValue = Boolean(values.get(key));

  if (force || !hadValue) {
    values.set(key, value);
    return hadValue ? "rotated" : "seeded";
  }

  return "preserved";
}

function render(values) {
  const ordered = [
    "# News Reader Vercel production env. Do not commit this file.",
    "NEWS_READER_ADMIN_USER",
    "NEWS_READER_ADMIN_PASSCODE",
    "NEWS_READER_SESSION_SECRET",
    "NEWS_READER_CRON_SECRET",
    "NEWS_READER_COOKIE_SECURE",
    "NEWS_READER_AUTH_REQUIRED",
    "",
    "# Life Graph production API.",
    "LIFE_GRAPH_API_BASE_URL",
    "LIFE_GRAPH_WRITE_TOKEN",
    "",
    "# Reader runtime.",
    "NEWS_READER_ITEMS_SOURCE",
    "NEWS_READER_BASE_URL",
    "",
    "# Vercel API token for repo-managed env/domain operations.",
    "VERCEL_TOKEN"
  ];
  const used = new Set();
  const output = [];

  for (const item of ordered) {
    if (item === "") {
      output.push("");
    } else if (item.startsWith("#")) {
      output.push(item);
    } else {
      output.push(`${item}=${values.get(item) || ""}`);
      used.add(item);
    }
  }

  for (const [key, value] of values.entries()) {
    if (!used.has(key)) {
      output.push(`${key}=${value}`);
    }
  }

  return `${output.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(args.envFile);
  const values = parseEnvFile(envPath);
  const results = [];

  results.push({ key: "NEWS_READER_ADMIN_USER", action: seed(values, "NEWS_READER_ADMIN_USER", "admin") });
  results.push({
    key: "NEWS_READER_ADMIN_PASSCODE",
    action: seed(values, "NEWS_READER_ADMIN_PASSCODE", randomSecret(24), { force: args.force })
  });
  results.push({
    key: "NEWS_READER_SESSION_SECRET",
    action: seed(values, "NEWS_READER_SESSION_SECRET", randomSecret(48), { force: args.force })
  });
  results.push({
    key: "NEWS_READER_CRON_SECRET",
    action: seed(values, "NEWS_READER_CRON_SECRET", randomSecret(32), { force: args.force })
  });
  results.push({ key: "NEWS_READER_COOKIE_SECURE", action: seed(values, "NEWS_READER_COOKIE_SECURE", "1") });
  results.push({ key: "NEWS_READER_AUTH_REQUIRED", action: seed(values, "NEWS_READER_AUTH_REQUIRED", "1") });
  results.push({ key: "LIFE_GRAPH_API_BASE_URL", action: seed(values, "LIFE_GRAPH_API_BASE_URL", "https://admin.jnap.me") });
  results.push({ key: "LIFE_GRAPH_WRITE_TOKEN", action: seed(values, "LIFE_GRAPH_WRITE_TOKEN", "") });
  results.push({ key: "NEWS_READER_ITEMS_SOURCE", action: seed(values, "NEWS_READER_ITEMS_SOURCE", "life_graph") });
  results.push({ key: "NEWS_READER_BASE_URL", action: seed(values, "NEWS_READER_BASE_URL", "https://news.selectproj.com") });
  results.push({ key: "VERCEL_TOKEN", action: seed(values, "VERCEL_TOKEN", "") });

  fs.writeFileSync(envPath, render(values), { mode: 0o600 });
  fs.chmodSync(envPath, 0o600);

  console.log(
    JSON.stringify(
      {
        ok: true,
        command: "vercel.env.seed",
        env_file: path.relative(process.cwd(), envPath),
        results
      },
      null,
      2
    )
  );
}

main();
