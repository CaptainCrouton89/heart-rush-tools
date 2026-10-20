#!/usr/bin/env node
// Development lifecycle for the Heart Rush web workspace: three Vite dev servers
// (apps/rules, apps/tools, apps/play), each a TanStack Start app on the Cloudflare Vite plugin.
// Run with Node >=26: node .grove/dev.ts -h
// Regenerate the crtr surface after changing the tree:
//   node .grove/dev.ts --emit-crtr-fragment > .crouter/commands/dev.json

import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { CommandError, defineCli, generateCrtrFragment, withExitCode, type JsonObject } from "./dev-cli.ts";

// The checkout this script belongs to — the source or a planted Grove instance.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runDir = resolve(root, ".grove/run");

const APPS = ["rules", "tools", "play"] as const;
type App = (typeof APPS)[number];

// Ports are base + slot * offset from .grove/config.json. Grove passes GROVE_PORT_<APP> when it
// dispatches; a direct run (node .grove/dev.ts, crtr dev) finds this checkout's slot in Grove's registry.
const portDefs = JSON.parse(readFileSync(resolve(root, ".grove/config.json"), "utf8")).ports as Record<App, { base: number; offset: number }>;
function registrySlot(): number {
  const registry = resolve(homedir(), ".grove/grove.json");
  if (!existsSync(registry)) return 0;
  const projects = Object.values(JSON.parse(readFileSync(registry, "utf8")).projects ?? {}) as { instances?: { path: string; slot: number }[] }[];
  for (const project of projects) {
    const instance = project.instances?.find((candidate) => resolve(candidate.path) === root);
    if (instance) return instance.slot;
  }
  return 0;
}
let slot: number | undefined;
function portOf(app: App): number {
  const fromGrove = process.env[`GROVE_PORT_${app.toUpperCase()}`];
  if (fromGrove) return Number(fromGrove);
  slot ??= registrySlot();
  return portDefs[app].base + slot * portDefs[app].offset;
}
const urlOf = (app: App) => `http://localhost:${portOf(app)}`;
const pidFile = (app: App) => resolve(runDir, `${app}.pid`);
const logFile = (app: App) => resolve(runDir, `${app}.log`);
const viteBin = (app: App) => resolve(root, "apps", app, "node_modules/.bin/vite");

function readPid(app: App): number | undefined {
  if (!existsSync(pidFile(app))) return undefined;
  const pid = Number(readFileSync(pidFile(app), "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

function alive(pid: number | undefined): boolean {
  if (pid === undefined) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Vite binds `localhost`, which macOS may resolve to ::1 only; accept either loopback.
function listeningOn(port: number, host: string): Promise<boolean> {
  return new Promise((done) => {
    const socket = createConnection({ port, host });
    socket.once("connect", () => { socket.destroy(); done(true); });
    socket.once("error", () => done(false));
  });
}
async function listening(port: number): Promise<boolean> {
  return (await listeningOn(port, "127.0.0.1")) || (await listeningOn(port, "::1"));
}

async function healthy(app: App): Promise<boolean> {
  try {
    // Each app's /health names itself, so a different app on this port does not count.
    const response = await fetch(`${urlOf(app)}/health`, { signal: AbortSignal.timeout(30_000) });
    return response.ok && ((await response.json()) as { app?: string }).app === app;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

type AppStatus = { app: App; state: string; port: number; url: string; pid: number | null; detail: string };
type Status = { state: string; apps: AppStatus[]; detail: string };

async function appStatus(app: App): Promise<AppStatus> {
  const pid = readPid(app);
  const owned = alive(pid);
  const port = portOf(app);
  const base = { app, port, url: urlOf(app), pid: owned ? pid! : null };
  const open = await listening(port);
  if (owned && open) {
    return (await healthy(app))
      ? { ...base, state: "running", detail: `vite (pid ${pid}) is serving ${app} on port ${port}; /health answered.` }
      : { ...base, state: "starting", detail: `vite (pid ${pid}) is listening on port ${port} but /health has not answered yet.` };
  }
  if (owned) return { ...base, state: "starting", detail: `vite (pid ${pid}) is alive but port ${port} is not listening yet.` };
  if (open) return { ...base, state: "foreign", detail: `Port ${port} is held by a process this checkout did not start (for example a manual \`pnpm dev\`).` };
  return { ...base, state: "stopped", detail: `No ${app} process for this checkout.` };
}

async function status(apps: readonly App[]): Promise<Status> {
  const results = await Promise.all(apps.map(appStatus));
  const states = new Set(results.map((r) => r.state));
  const state = states.size === 1 ? [...states][0] : "mixed";
  const detail = results.map((r) => `${r.app}: ${r.state}`).join(", ");
  return { state, apps: results, detail };
}

async function startApp(app: App): Promise<void> {
  const before = await appStatus(app);
  if (before.state !== "stopped") return;
  if (!existsSync(viteBin(app))) {
    throw new CommandError({ code: "not_installed", message: `apps/${app}/node_modules is missing in ${root}.`, field: "app", received: app, expected: "installed workspace dependencies", next: "Run `pnpm install` at the checkout root, then retry." });
  }
  mkdirSync(runDir, { recursive: true });
  const log = openSync(logFile(app), "w");
  const child = spawn(viteBin(app), ["dev", "--port", String(portOf(app)), "--strictPort"], {
    cwd: resolve(root, "apps", app),
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, PORT: String(portOf(app)) },
  });
  closeSync(log);
  writeFileSync(pidFile(app), `${child.pid}\n`);
  child.unref();
  for (let waited = 0; waited < 90_000; waited += 500) {
    if (!alive(child.pid)) {
      rmSync(pidFile(app), { force: true });
      throw new CommandError({ code: "start_failed", message: `${app}: vite exited during startup.`, field: "app", received: app, expected: "a dev server answering /health", next: `Read \`dev service logs --app ${app}\` (${logFile(app)}), fix the cause, and retry.` });
    }
    if ((await listening(portOf(app))) && (await healthy(app))) return;
    await sleep(500);
  }
}

// Sequential on purpose: each app's Cloudflare plugin claims the first free Worker inspector port
// from 9229 during startup, so concurrent starts can pick the same port and one dies EADDRINUSE.
async function start(apps: readonly App[]): Promise<Status> {
  for (const app of apps) await startApp(app);
  return status(apps);
}

async function stopApp(app: App): Promise<void> {
  const pid = readPid(app);
  if (alive(pid)) {
    // vite was started as a process-group leader; signal the whole group (workerd included).
    try { process.kill(-pid!, "SIGTERM"); } catch { process.kill(pid!, "SIGTERM"); }
    for (let waited = 0; waited < 10_000 && alive(pid); waited += 250) await sleep(250);
    if (alive(pid)) { try { process.kill(-pid!, "SIGKILL"); } catch { process.kill(pid!, "SIGKILL"); } }
    for (let waited = 0; waited < 5_000 && (await listening(portOf(app))); waited += 250) await sleep(250);
  }
  rmSync(pidFile(app), { force: true });
}

async function stop(apps: readonly App[]): Promise<Status> {
  await Promise.all(apps.map(stopApp));
  return status(apps);
}

const selected = (input: Readonly<Record<string, unknown>>): readonly App[] =>
  input.app === "all" || input.app === undefined ? APPS : [input.app as App];

const appParam = {
  kind: "flag" as const,
  name: "app",
  type: "enum" as const,
  values: ["all", ...APPS],
  default: "all",
  description: "Which app to act on: rules, tools, play, or all three.",
};

const appStatusShape = "{ app, state, port, url, pid, detail }";
const statusOutput = [
  { name: "state", type: "string", description: "running, starting, stopped, or foreign (port held by a process this checkout did not start) when every selected app agrees; mixed otherwise." },
  { name: "apps", type: "object[]", description: `One entry per selected app: ${appStatusShape}. port is 3910/3911/3912 (rules/tools/play) in the source and base + slot * 100 in a Grove instance; running means /health answered with this app's name.` },
  { name: "detail", type: "string", description: "One line summarizing each app's state." },
];
const renderStatus = (value: JsonObject) => {
  const s = value as unknown as Status;
  return {
    attributes: { state: s.state },
    body: s.apps.map((a) => `${a.app.padEnd(5)} ${a.state.padEnd(8)} ${a.url}  — ${a.detail}`).join("\n"),
  };
};
const exitFor = (result: Status) => withExitCode(result as unknown as JsonObject, result.state === "running" ? 0 : 1);

const definition = {
  name: "dev",
  description: "Heart Rush web workspace development lifecycle.",
  commands: [
    {
      name: "service",
      description: "the local Vite dev servers for the rules, tools, and play apps in this checkout.",
      whenToUse: "you need one of the Heart Rush sites running locally, need to know whether it is up, or need its logs.",
      model: "Three processes, one per app: `vite dev` in apps/<app> on this checkout's port for that app (source: rules 3910, tools 3911, play 3912; a Grove instance adds slot * 100). Each runs the app's Worker locally through the Cloudflare Vite plugin. Every leaf takes --app to act on one app; the default is all three. Northlight sign-in only works on the source ports, because only localhost:3911 and :3912 are registered redirect URIs.",
      children: [
        {
          name: "status",
          description: "report whether this checkout's dev servers are running.",
          whenToUse: "before starting, testing against, or debugging a local site.",
          params: [appParam],
          output: statusOutput,
          effects: ["None. Read-only."],
          result: { block: "service-status", render: renderStatus },
          run: async (input: Readonly<Record<string, unknown>>) => (await status(selected(input))) as unknown as JsonObject,
        },
        {
          name: "start",
          description: "start vite dev in the background for the selected apps and wait until each answers /health.",
          whenToUse: "a site must be running to view or test a change.",
          params: [appParam],
          output: statusOutput,
          effects: ["Starts a detached vite dev process per selected app; pid in .grove/run/<app>.pid, output in .grove/run/<app>.log.", "Leaves an app alone when this checkout's server for it is already running or its port is held by another process."],
          result: { block: "service-start", render: renderStatus },
          run: async (input: Readonly<Record<string, unknown>>) => exitFor(await start(selected(input))),
        },
        {
          name: "stop",
          description: "stop the dev servers this checkout started.",
          whenToUse: "a local site is no longer needed, or before a clean restart.",
          params: [appParam],
          output: statusOutput,
          effects: ["Sends SIGTERM (then SIGKILL after 10s) to each selected vite process group this checkout started.", "Never touches a process it did not start."],
          result: { block: "service-stop", render: renderStatus },
          run: async (input: Readonly<Record<string, unknown>>) => (await stop(selected(input))) as unknown as JsonObject,
        },
        {
          name: "restart",
          description: "stop, then start the selected dev servers.",
          whenToUse: "a server is wedged or must pick up a change Vite does not hot-reload, such as vite.config.ts or wrangler.jsonc.",
          params: [appParam],
          output: statusOutput,
          effects: ["Same as stop followed by start."],
          result: { block: "service-restart", render: renderStatus },
          run: async (input: Readonly<Record<string, unknown>>) => {
            await stop(selected(input));
            return exitFor(await start(selected(input)));
          },
        },
        {
          name: "logs",
          description: "read recent output from one app's dev server.",
          whenToUse: "a page errors, a server will not start, or you need build or request output.",
          params: [
            { ...appParam, values: [...APPS], default: undefined, required: true, description: "Which app's log to read: rules, tools, or play." },
            { kind: "flag" as const, name: "tail", type: "integer" as const, description: "Number of most recent lines to return.", default: 60, min: 1 },
          ],
          output: [
            { name: "path", type: "string", description: "Absolute path of the log file." },
            { name: "lines", type: "string[]", description: "The most recent log lines, oldest first." },
          ],
          effects: ["None. Read-only."],
          result: {
            block: "service-logs",
            render: (value: JsonObject) => {
              const logs = value as { path: string; lines: string[] };
              return { attributes: { path: logs.path }, body: logs.lines.length ? logs.lines.join("\n") : "no log yet — this app has not been started from this checkout." };
            },
          },
          run: async (input: Readonly<Record<string, unknown>>) => {
            const path = logFile(input.app as App);
            const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean) : [];
            return { path, lines: lines.slice(-(input.tail as number)) };
          },
        },
      ],
    },
  ],
};

const cli = defineCli(definition);

if (process.argv.length === 3 && process.argv[2] === "--emit-crtr-fragment") {
  process.stdout.write(`${JSON.stringify(generateCrtrFragment(definition, ".grove/dev.ts"), null, 2)}\n`);
} else {
  cli.run();
}
