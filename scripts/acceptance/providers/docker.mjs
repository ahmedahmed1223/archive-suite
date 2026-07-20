import { spawn } from "node:child_process";

const PROJECT_PREFIX = "archive-acceptance-";
const PROJECT_NAME_PATTERN = /^archive-acceptance-[a-z0-9-]+$/;
const COMPOSE_ENV_FILE = "infra/.env.example";
const COMPOSE_FILE = "infra/docker-compose.laravel-next.yml";

function defaultRun(command, args, { root, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
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
  const composeArgs = () => [
    "compose",
    "--project-name", projectName,
    "--env-file", COMPOSE_ENV_FILE,
    "--file", COMPOSE_FILE,
  ];
  let ports;
  const ensurePorts = async () => {
    ports ??= Object.freeze({ next: await getFreePort(), reverb: await getFreePort() });
    return ports;
  };
  const invoke = async (args, action) => {
    const allocated = await ensurePorts();
    const env = {
      ...process.env,
      NEXT_PUBLIC_PORT: String(allocated.next),
      REVERB_SERVER_PUBLISHED_PORT: String(allocated.reverb),
      REVERB_PORT: String(allocated.reverb),
    };
    return assertSucceeded(await execute("docker", args, { root, env, shell: false }), action);
  };

  const provider = {
    capabilities: Object.freeze(["docker"]),
    projectName,

    async prepare() {
      await ensurePorts();
      await invoke([...composeArgs(), "config"], "Docker Compose configuration validation");
      return { projectName, ports };
    },

    async install() {
      return invoke([...composeArgs(), "pull"], "Docker Compose image pull");
    },

    async start() {
      return invoke([...composeArgs(), "up", "--detach", "--wait"], "Docker Compose startup");
    },

    async exec(service, args = []) {
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(service)) throw new Error("Docker Compose service is invalid");
      if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) throw new Error("Docker exec arguments are invalid");
      return invoke([...composeArgs(), "exec", "-T", service, ...args], `Docker Compose exec for ${service}`);
    },

    async collect() {
      return invoke([...composeArgs(), "ps", "--all", "--format", "json"], "Docker Compose status collection");
    },

    async reset() {
      await invoke([...composeArgs(), "down", "--volumes", "--remove-orphans"], "Docker Compose reset");
      return provider.start();
    },

    async destroy() {
      await invoke([...composeArgs(), "down", "--volumes", "--remove-orphans"], "Docker Compose cleanup");
      const leftovers = await invoke([
        "ps", "--all",
        "--filter", `label=com.docker.compose.project=${projectName}`,
        "--format", "{{.ID}}",
      ], "Docker scoped cleanup verification");
      if (String(leftovers.stdout ?? "").trim()) {
        throw new Error(`Docker cleanup left leftover containers for project ${projectName}`);
      }
      return { projectName, proved: true };
    },
  };

  return Object.freeze(provider);
}
