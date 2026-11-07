// Waits until a dependency answers, for the Railway start wrapper.
//
//   node wait-ready.mjs <VARIABLE_NAME> <seconds>
//
// The URL is read from the named environment variable, so credentials never appear in a process
// list. postgres:// and postgresql:// URLs are probed with a TCP connect to host:port;
// http:// and https:// URLs with a GET that must answer 2xx. Only host and port are logged.
// Exit codes: 0 ready, 1 timed out, 2 bad arguments or URL.
import { realpathSync } from "node:fs";
import net from "node:net";
import { pathToFileURL } from "node:url";

const PROBE_TIMEOUT_MS = 5_000;
const INTERVAL_MS = 3_000;
const LOG_EVERY_MS = 30_000;

function fail(message, code) {
  process.stderr.write(`[rakazo-railway] wait: ${message}\n`);
  process.exit(code);
}

export function parseTarget(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) return undefined;
  if (url.protocol === "postgres:" || url.protocol === "postgresql:") {
    return { kind: "tcp", host, port: Number(url.port || 5432), label: `${host}:${url.port || 5432}` };
  }
  if (url.protocol === "http:" || url.protocol === "https:") {
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    // Rebuilt without credentials, query or fragment: only the path is probed.
    const probe = `${url.protocol}//${url.host}${url.pathname}`;
    return { kind: "http", url: probe, label: `${host}:${port}${url.pathname}` };
  }
  return undefined;
}

function tcpProbe({ host, port }) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

async function httpProbe({ url }) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitFor(target, seconds, { now = Date.now, sleep, log } = {}) {
  const pause = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const say = log ?? ((line) => process.stderr.write(`${line}\n`));
  const probe = target.kind === "tcp" ? tcpProbe : httpProbe;
  const started = now();
  let lastLog = started;
  for (;;) {
    if (await probe(target)) return true;
    const elapsed = now() - started;
    if (elapsed >= seconds * 1000) return false;
    if (now() - lastLog >= LOG_EVERY_MS) {
      say(`[rakazo-railway] still waiting for ${target.label} (${Math.round(elapsed / 1000)} s)`);
      lastLog = now();
    }
    await pause(INTERVAL_MS);
  }
}

async function main() {
  const [name, secondsArg] = process.argv.slice(2);
  if (!name || !/^[A-Z][A-Z0-9_]*$/.test(name)) fail("usage: wait-ready.mjs VARIABLE seconds", 2);
  const seconds = Number(secondsArg);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86_400)
    fail("seconds must be a whole number from 1 to 86400", 2);
  const raw = process.env[name]?.trim();
  if (!raw) fail(`${name} is empty`, 2);
  const target = parseTarget(raw);
  if (!target) fail(`${name} is not a postgres:// or http(s):// URL`, 2);
  process.stderr.write(`[rakazo-railway] waiting up to ${seconds} s for ${target.label}\n`);
  if (await waitFor(target, seconds)) {
    process.stderr.write(`[rakazo-railway] ${target.label} is ready\n`);
    process.exit(0);
  }
  fail(`${target.label} did not answer within ${seconds} s`, 1);
}

const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) await main();
