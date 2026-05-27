import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_MANIFEST = "ops/vercel/news-reader.manifest.json";

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: false,
    envFile: "",
    manifest: DEFAULT_MANIFEST,
    only: "",
    target: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--env-file") args.envFile = argv[++index] || "";
    else if (arg === "--manifest") args.manifest = argv[++index] || DEFAULT_MANIFEST;
    else if (arg === "--only") args.only = argv[++index] || "";
    else if (arg === "--target") args.target = argv[++index] || "";
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
  node scripts/vercel-sync-env.mjs --dry-run
  node scripts/vercel-sync-env.mjs --apply

Options:
  --manifest <path>  Vercel ops manifest. Default: ${DEFAULT_MANIFEST}
  --env-file <path>  Untracked env file. Default comes from manifest env_file.
  --target <name>    Restrict sync to one target, such as production.
  --only <KEY>       Restrict sync to one env var key.
  --apply            Push values to Vercel with the REST API. Requires VERCEL_TOKEN.
  --dry-run          Validate and print the planned updates without mutating Vercel.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function valueFor(entry, envFileValues) {
  if (Object.prototype.hasOwnProperty.call(process.env, entry.key)) {
    return { source: "process", value: process.env[entry.key] || "" };
  }
  if (Object.prototype.hasOwnProperty.call(envFileValues, entry.key)) {
    return { source: "env_file", value: envFileValues[entry.key] || "" };
  }
  if (Object.prototype.hasOwnProperty.call(entry, "default")) {
    return { source: "manifest_default", value: String(entry.default) };
  }
  return { source: "missing", value: "" };
}

function validateManifest(manifest) {
  const blockers = [];

  if (manifest.schema_version !== "news-reader.vercel-ops.v1") {
    blockers.push("manifest schema_version must be news-reader.vercel-ops.v1");
  }
  if (!manifest.project) {
    blockers.push("manifest project is required");
  }
  if (!Array.isArray(manifest.env) || manifest.env.length === 0) {
    blockers.push("manifest env must contain at least one entry");
  }

  for (const entry of manifest.env || []) {
    if (!entry.key) blockers.push("each env entry requires key");
    if (!["plain", "sensitive"].includes(entry.type)) blockers.push(`${entry.key} type must be plain or sensitive`);
    if (!Array.isArray(entry.targets) || entry.targets.length === 0) blockers.push(`${entry.key} requires targets`);
  }

  return blockers;
}

function plannedUpdates(manifest, args, envFileValues) {
  const updates = [];
  const missing = [];

  for (const entry of manifest.env) {
    if (args.only && entry.key !== args.only) {
      continue;
    }

    const targets = entry.targets.filter((target) => !args.target || target === args.target);

    if (targets.length === 0) {
      continue;
    }

    const resolved = valueFor(entry, envFileValues);

    if (entry.required && !resolved.value) {
      missing.push(entry.key);
      continue;
    }

    if (!resolved.value) {
      continue;
    }

    for (const target of targets) {
      updates.push({
        key: entry.key,
        project: manifest.project,
        source: resolved.source,
        target,
        type: entry.type,
        value: resolved.value
      });
    }
  }

  return { missing, updates };
}

function vercelProjectUrl(manifest, suffix) {
  const url = new URL(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(manifest.project)}${suffix}`
  );

  url.searchParams.set("upsert", "true");
  if (manifest.team_id) {
    url.searchParams.set("teamId", manifest.team_id);
  }
  if (manifest.team_slug) {
    url.searchParams.set("slug", manifest.team_slug);
  }

  return url;
}

async function runVercelEnvUpdate(manifest, update, token) {
  const response = await fetch(vercelProjectUrl(manifest, "/env"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      key: update.key,
      target: [update.target],
      type: update.type,
      value: update.value
    })
  });
  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch (_err) {
    payload = { message: text.slice(0, 500) };
  }

  return {
    key: update.key,
    ok: response.ok,
    status: response.status,
    message: payload.error?.message || payload.message || response.statusText,
    target: update.target
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifest);
  const manifest = readJson(manifestPath);
  const manifestBlockers = validateManifest(manifest);
  const envFile = args.envFile || manifest.env_file || "";
  const envFilePath = envFile ? path.resolve(envFile) : "";
  const envFileValues = parseEnvFile(envFilePath);
  const { missing, updates } = plannedUpdates(manifest, args, envFileValues);
  const blockers = [...manifestBlockers, ...missing.map((key) => `${key} is required but missing`)];
  const apply = args.apply && !args.dryRun;

  if (apply && !process.env.VERCEL_TOKEN) {
    blockers.push("VERCEL_TOKEN is required when applying Vercel env updates");
  }

  if (blockers.length) {
    console.log(JSON.stringify({ ok: false, status: "blocked", blockers }, null, 2));
    if (apply) {
      process.exit(1);
    }
    return;
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          status: "dry_run",
          command: "vercel.env.sync",
          manifest: path.relative(process.cwd(), manifestPath),
          env_file: envFilePath ? path.relative(process.cwd(), envFilePath) : "",
          project: manifest.project,
          planned: updates.map(({ key, source, target, type }) => ({ key, source, target, type }))
        },
        null,
        2
      )
    );
    return;
  }

  const results = [];

  for (const update of updates) {
    results.push(await runVercelEnvUpdate(manifest, update, process.env.VERCEL_TOKEN));
  }

  const failed = results.filter((result) => !result.ok);

  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        status: failed.length === 0 ? "ok" : "blocked",
        command: "vercel.env.sync",
        project: manifest.project,
        results: results.map(({ key, ok, status, target }) => ({ key, ok, status, target })),
        blockers: failed.map((result) => ({
          code: "vercel_env_update_failed",
          key: result.key,
          target: result.target,
          message: result.message || `Vercel API returned ${result.status}`
        }))
      },
      null,
      2
    )
  );

  if (failed.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, status: "blocked", blockers: [{ message: err.message }] }, null, 2));
  process.exit(1);
});
