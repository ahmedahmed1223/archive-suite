import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_PREFIX = "archive-acceptance-";
const PROJECT_NAME_PATTERN = /^archive-acceptance-[a-z0-9-]+$/;
const COMPOSE_FILE = "infra/docker-compose.laravel-next.yml";

function secret(bytes = 32) { return randomBytes(bytes).toString("base64url"); }

function createRunEnvironment(runId) {
  const directory = mkdtempSync(join(tmpdir(), `archive-acceptance-${runId}-`));
  const path = join(directory, "compose.env");
  const password = `Aa1!${secret(24)}`;
  const values = {
    APP_KEY: `base64:${secret(32)}`,
    ARCHIVE_SECURE_COOKIES: "false",
    ADMIN_EMAIL: `acceptance-${runId}@archive.test`,
    ADMIN_NAME: "Acceptance Admin",
    ADMIN_PASSWORD: password,
    POSTGRES_PASSWORD: secret(), REDIS_PASSWORD: secret(),
    REVERB_APP_ID: `acceptance-${runId}`, REVERB_APP_KEY: secret(18), REVERB_APP_SECRET: secret(),
    JWT_AUTH_SECRET: secret(),
  };
  writeFileSync(path, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  return { directory, path, credentials: Object.freeze({ email: values.ADMIN_EMAIL, password }) };
}

function defaultRun(command, args, { root, env, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      signal,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function assertSucceeded(result, action) {
  if (result?.status !== 0) {
    const detail = String(result?.stderr || result?.stdout || "").trim();
    throw new Error(`${action} failed${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

/**
 * Runs the acceptance stack under a Compose project owned exclusively by one
 * acceptance run.  It deliberately never discovers or acts on any project
 * other than its own label.
 */
export function createDockerProvider({ root, runId, run, getFreePort }) {
  const projectName = `${PROJECT_PREFIX}${runId}`;
  if (!PROJECT_NAME_PATTERN.test(projectName)) {
    throw new Error("Docker project name must match archive-acceptance-[a-z0-9-]+");
  }
  if (typeof getFreePort !== "function") throw new Error("getFreePort is required");

  const execute = run ?? ((command, args, options) => defaultRun(command, args, options));
  const runEnvironment = createRunEnvironment(runId);
  const composeArgs = () => [
    "compose",
    "--project-name", projectName,
    "--env-file", runEnvironment.path,
    "--file", COMPOSE_FILE,
  ];
  let ports;
  const ensurePorts = async () => {
    ports ??= Object.freeze({ next: await getFreePort(), reverb: await getFreePort() });
    return ports;
  };
  const invoke = async (args, action, { signal } = {}) => {
    const allocated = await ensurePorts();
    const env = {
      ...process.env,
      NEXT_PUBLIC_PORT: String(allocated.next),
      REVERB_SERVER_PUBLISHED_PORT: String(allocated.reverb),
      REVERB_PORT: String(allocated.reverb),
    };
    return assertSucceeded(await execute("docker", args, { root, env, shell: false, signal }), action);
  };

  const provider = {
    name: "docker",
    capabilities: Object.freeze(["docker"]),
    projectName,
    credentials: runEnvironment.credentials,
    get endpoints() {
      if (!ports) throw new Error("Docker endpoints are unavailable before prepare");
      return Object.freeze({ next: `http://127.0.0.1:${ports.next}`, api: `http://127.0.0.1:${ports.next}/api/v1` });
    },

    describe() {
      const allocated = ports ? { ...ports } : {};
      return {
        name: "docker",
        capabilities: ["docker"],
        project: projectName,
        resources: { publishedPorts: allocated },
        endpoints: ports ? provider.endpoints : {},
        imageDigests: [],
      };
    },

    async prepare({ signal } = {}) {
      await ensurePorts();
      await invoke([...composeArgs(), "config"], "Docker Compose configuration validation", { signal });
      return { projectName, ports };
    },

    async install({ signal } = {}) {
      return invoke([...composeArgs(), "pull"], "Docker Compose image pull", { signal });
    },

    async start({ signal } = {}) {
      return invoke([...composeArgs(), "up", "--detach", "--wait"], "Docker Compose startup", { signal });
    },

    async exec(service, args = [], { signal } = {}) {
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(service)) throw new Error("Docker Compose service is invalid");
      if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) throw new Error("Docker exec arguments are invalid");
      return invoke([...composeArgs(), "exec", "-T", service, ...args], `Docker Compose exec for ${service}`, { signal });
    },

    async collect() {
      return invoke([...composeArgs(), "ps", "--all", "--format", "json"], "Docker Compose status collection");
    },

    async reset() {
      await invoke([...composeArgs(), "down", "--volumes", "--remove-orphans"], "Docker Compose reset");
      return provider.start();
    },

    async destroy() {
      try {
        await invoke([...composeArgs(), "down", "--volumes", "--remove-orphans"], "Docker Compose cleanup");
        const ownershipFilter = `label=com.docker.compose.project=${projectName}`;
        const resourceChecks = await Promise.all([
          invoke(["ps", "--all", "--filter", ownershipFilter, "--format", "{{.ID}}"], "Docker container cleanup verification"),
          invoke(["network", "ls", "--filter", ownershipFilter, "--format", "{{.ID}}"], "Docker network cleanup verification"),
          invoke(["volume", "ls", "--filter", ownershipFilter, "--format", "{{.ID}}"], "Docker volume cleanup verification"),
        ]);
        const leftoverTypes = ["containers", "networks", "volumes"].filter((_, index) => String(resourceChecks[index].stdout ?? "").trim());
        if (leftoverTypes.length) throw new Error(`Docker cleanup left leftover ${leftoverTypes.join(", ")} for project ${projectName}`);
      } finally {
        rmSync(runEnvironment.directory, { recursive: true, force: true });
      }
      return { projectName, proved: true };
    },
  };

  return Object.freeze(provider);
}
