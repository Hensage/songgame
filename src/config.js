import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function readJsonConfig(env) {
  const merged = {};
  for (const fileName of ['default.json', `${env}.json`]) {
    const filePath = path.join(ROOT_DIR, 'config', fileName);
    try {
      Object.assign(merged, JSON.parse(readFileSync(filePath, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Could not read config/${fileName}: ${error.message}`);
      }
    }
  }
  return merged;
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parsePort(value) {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port >= 0 && port < 65536 ? port : 3000;
}

/**
 * Configuration is resolved in this order (later wins):
 *   1. config/default.json
 *   2. config/<NODE_ENV>.json
 *   3. environment variables
 *   4. explicit overrides (used by tests)
 *
 * The JSON files are optional; deployments are expected to use environment
 * variables (Fly secrets) instead of committing credentials.
 */
export function loadConfig(overrides = {}) {
  const env = process.env.NODE_ENV ?? 'development';
  const fileConfig = readJsonConfig(env);
  const port = parsePort(process.env.PORT ?? fileConfig.port ?? 3000);

  const config = {
    env,
    port,
    rootDir: ROOT_DIR,
    pagesDir: path.join(ROOT_DIR, 'pages'),
    publicDir: path.join(ROOT_DIR, 'public'),
    stub: parseBoolean(process.env.STUB) ?? parseBoolean(fileConfig.stub) ?? env !== 'production',
    clientId: process.env.SPOTIFY_CLIENT_ID ?? fileConfig.client_id ?? '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? fileConfig.client_secret ?? '',
    redirectUri:
      process.env.SPOTIFY_REDIRECT_URI ?? fileConfig.redirect_uri ?? `http://localhost:${port}/callback`,
    gamesFilePath:
      process.env.GAMES_FILE ?? fileConfig.volumePath ?? path.join(ROOT_DIR, 'stubdata', 'games.json'),
    stubSearchPath: path.join(ROOT_DIR, 'stubdata', 'search.json'),
    gameLifetimeMs: 6 * HOUR,
    tokenLifetimeMs: 55 * MINUTE,
    loginStateTtlMs: 10 * MINUTE,
    sweepIntervalMs: 1000,
  };

  return { ...config, ...overrides };
}

export function assertConfig(config) {
  if (config.stub) return;

  const missing = [
    ['SPOTIFY_CLIENT_ID', config.clientId],
    ['SPOTIFY_CLIENT_SECRET', config.clientSecret],
    ['SPOTIFY_REDIRECT_URI', config.redirectUri],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing Spotify configuration: ${missing.join(', ')}. ` +
        'Set these environment variables or enable stub mode with STUB=true.',
    );
  }
}