import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function createDockerCompose({ composeFile, infraDir, envPath, readEnv, output, loadPlatformContract, resolveComposeProfiles }) {
  const dockerComposeCmd = () => {
    const v2 = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
    if (v2.status === 0) return { bin: "docker", pre: ["compose"] };
    const v1 = spawnSync("docker-compose", ["version"], { stdio: "ignore" });
    if (v1.status === 0) return { bin: "docker-compose", pre: [] };
    return null;
  };
  const composeProfileArgs = (env = process.env) => {
    const configuredProfiles = env.ARCHIVE_COMPOSE_PROFILES ?? readEnv().ARCHIVE_COMPOSE_PROFILES;
    return resolveComposeProfiles(loadPlatformContract(), configuredProfiles).flatMap((profile) => ["--profile", profile]);
  };
  const compose = (actionArgs, { inherit = true, input, env } = {}) => {
    let profileArgs;
    try { profileArgs = composeProfileArgs(env ? { ...process.env, ...env } : process.env); }
    catch (error) { output.err(error.message); return { status: 1 }; }
    const docker = dockerComposeCmd();
    if (!docker) { output.err("Docker (with Compose) was not found. Install Docker first."); return { status: 127 }; }
    const args = [
      ...docker.pre, "-f", composeFile, ...(existsSync(envPath) ? ["--env-file", envPath] : []),
      ...profileArgs, ...actionArgs,
    ];
    return spawnSync(docker.bin, args, { cwd: infraDir, stdio: inherit ? "inherit" : "pipe", encoding: "utf8", input, env: env ? { ...process.env, ...env } : process.env });
  };
  return { dockerComposeCmd, compose, composeProfileArgs };
}
