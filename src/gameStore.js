import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Game } from './game.js';

export class GameStore {
  constructor({ gamesFilePath, gameFactory = (data) => Game.fromJSON(data), logger = console, sweepIntervalMs = 1000 }) {
    this.gamesFilePath = gamesFilePath;
    this.gameFactory = gameFactory;
    this.logger = logger;
    this.sweepIntervalMs = sweepIntervalMs;
    this.games = [];
    this.savePromise = null;
    this.saveRequested = false;
    this.sweepTimer = null;
  }

  async load() {
    let raw;
    try {
      raw = await readFile(this.gamesFilePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.save();
        return;
      }
      throw error;
    }

    let records;
    try {
      records = JSON.parse(raw);
    } catch (error) {
      this.logger.error(`Could not parse ${this.gamesFilePath}: ${error.message}. Starting with no games.`);
      records = [];
    }

    this.games = (Array.isArray(records) ? records : []).map((record) => this.gameFactory(record));
  }

  all() {
    return this.games;
  }

  findById(gameid) {
    return this.games.find((game) => game.gameid === gameid);
  }

  findByPlayerId(playerID) {
    return this.games.find((game) => game.isPlayerInGame(playerID));
  }

  add(game) {
    this.games.push(game);
  }

  remove(gameid) {
    const index = this.games.findIndex((game) => game.gameid === gameid);
    if (index === -1) return false;

    this.games.splice(index, 1);
    return true;
  }

  startSweep() {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweep(), this.sweepIntervalMs);
  }

  stopSweep() {
    if (!this.sweepTimer) return;
    clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  sweep() {
    const now = Date.now();
    let changed = false;

    for (const game of [...this.games]) {
      game.tick().catch((error) => {
        this.logger.error(`Token refresh failed for game ${game.gameid}:`, error);
      });

      if (game.kill || game.fullyExpires < now) {
        this.remove(game.gameid);
        changed = true;
      }
    }

    if (changed) this.save();
  }

  /** Queues a snapshot write. Calls are coalesced while a write is in flight. */
  save() {
    this.saveRequested = true;
    if (!this.savePromise) {
      this.savePromise = this.#writeLoop();
    }
    return this.savePromise;
  }

  async flush() {
    if (this.savePromise) await this.savePromise;
  }

  async #writeLoop() {
    try {
      while (this.saveRequested) {
        this.saveRequested = false;
        try {
          await this.#writeSnapshot();
        } catch (error) {
          this.logger.error(`Could not save games to ${this.gamesFilePath}:`, error);
        }
      }
    } finally {
      this.savePromise = null;
    }
  }

  async #writeSnapshot() {
    const data = JSON.stringify(this.games);
    const directory = path.dirname(this.gamesFilePath);
    const temporaryPath = `${this.gamesFilePath}.${process.pid}.tmp`;

    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, data, 'utf8');
    await rename(temporaryPath, this.gamesFilePath);
  }
}