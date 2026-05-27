import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_MANIFEST = "ops/vercel/news-reader.manifest.json";

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: false,
    manifest: DEFAULT_MANIFEST
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--manifest") args.manifest = argv[++index] || DEFAULT_MANIFEST;
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
  node scripts/vercel-add-domain.mjs --dry-run
  node scripts/vercel-add-domain.mjs --apply

Options:
  --manifest <path>  Vercel ops manifest. Default: ${DEFAULT_MANIFEST}
  --apply            Attach the manifest domain with the REST API. Requires VERCEL_TOKEN.
  --dry-run          Print the planned domain operation without mutating Vercel.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateManifest(manifest) {
  const blockers = [];

  if (manifest.schema_version !== "news-reader.vercel-ops.v1") {
    blockers.push("manifest schema_version must be news-reader.vercel-ops.v1");
  }
  if (!manifest.project) {
    blockers.push("manifest project is required");
  }
  if (!manifest.domain) {
    blockers.push("manifest domain is required");
  }

  return blockers;
}

function projectDomainUrl(manifest, version, suffix = "") {
  const url = new URL(
    `https://api.vercel.com/${version}/projects/${encodeURIComponent(manifest.project)}/domains${suffix}`
  );

  if (manifest.team_id) {
    url.searchParams.set("teamId", manifest.team_id);
  }
  if (manifest.team_slug) {
    url.searchParams.set("slug", manifest.team_slug);
  }

  return url;
}

async function parseResponse(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch (_err) {
    return { message: text.slice(0, 500) };
  }
}

async function getProjectDomain(manifest, token) {
  const response = await fetch(projectDomainUrl(manifest, "v9", `/${encodeURIComponent(manifest.domain)}`), {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json"
    }
  });
  const payload = await parseResponse(response);

  return { ok: response.ok, payload, status: response.status };
}

async function addProjectDomain(manifest, token) {
  const response = await fetch(projectDomainUrl(manifest, "v10"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ name: manifest.domain })
  });
  const payload = await parseResponse(response);

  return { ok: response.ok, payload, status: response.status };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifest);
  const manifest = readJson(manifestPath);
  const blockers = validateManifest(manifest);
  const apply = args.apply && !args.dryRun;

  if (apply && !process.env.VERCEL_TOKEN) {
    blockers.push("VERCEL_TOKEN is required when applying Vercel domain updates");
  }

  if (blockers.length) {
    console.log(JSON.stringify({ ok: false, status: "blocked", blockers }, null, 2));
    process.exit(1);
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          status: "dry_run",
          command: "vercel.domain.add",
          manifest: path.relative(process.cwd(), manifestPath),
          project: manifest.project,
          domain: manifest.domain
        },
        null,
        2
      )
    );
    return;
  }

  const current = await getProjectDomain(manifest, process.env.VERCEL_TOKEN);
  let result = current;
  let commandStatus = "existing";

  if (current.status === 404) {
    result = await addProjectDomain(manifest, process.env.VERCEL_TOKEN);
    commandStatus = "created";
  }

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        status: result.ok ? "ok" : "blocked",
        command: "vercel.domain.add",
        action: commandStatus,
        project: manifest.project,
        domain: manifest.domain,
        verified: result.payload?.verified,
        blockers: result.ok
          ? []
          : [
              {
                code: "vercel_domain_add_failed",
                message: result.payload?.error?.message || result.payload?.message || `Vercel API returned ${result.status}`
              }
            ]
      },
      null,
      2
    )
  );

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, status: "blocked", blockers: [{ message: err.message }] }, null, 2));
  process.exit(1);
});
