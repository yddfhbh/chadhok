import fs from "node:fs/promises";
import path from "node:path";

// Strict opt-in per channel. Neither ordinary bots nor webhooks can trigger it.
export class PeerChat {
  constructor({ filePath, guildId, peerIds = [], ownerId, cooldownMs = 3000,
                maxAgeMs = 90000, now = Date.now,
                sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    this.filePath = filePath;
    this.guildId = guildId;
    this.peerIds = new Set(peerIds);
    this.ownerId = ownerId;
    this.cooldownMs = cooldownMs;
    this.maxAgeMs = maxAgeMs;
    this.now = now;
    this.sleep = sleep;
    this.channels = new Set();
    this.running = new Set();
    this.pending = new Map();
    this.lastAttemptAt = new Map();
    this.loaded = null;
    this.saveQueue = Promise.resolve();
  }

  async load() {
    this.loaded ??= (async () => {
      try {
        const state = JSON.parse(await fs.readFile(this.filePath, "utf8"));
        if (Array.isArray(state.enabledChannelIds)) {
          for (const id of state.enabledChannelIds) {
            if (/^\d{15,22}$/.test(String(id))) this.channels.add(String(id));
          }
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    })();
    return this.loaded;
  }

  async setEnabled(channelId, enabled) {
    await this.load();
    if (!/^\d{15,22}$/.test(String(channelId))) throw new Error("invalid channel");
    if (enabled) {
      this.channels.add(channelId);
    } else {
      this.channels.delete(channelId);
      this.pending.delete(channelId);
    }
    this.saveQueue = this.saveQueue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify({
        version: 1, enabledChannelIds: [...this.channels],
      }, null, 2) + "\n", { mode: 0o600 });
    });
    await this.saveQueue;
    return enabled;
  }

  isEnabled(channelId) {
    return this.channels.has(channelId);
  }

  isPeerMessage(message, ownBotId) {
    return Boolean(this.guildId && message?.guildId === this.guildId &&
      message.channelId && this.peerIds.has(message.author?.id) &&
      message.author?.bot === true && !message.webhookId &&
      message.author.id !== ownBotId &&
      typeof message.content === "string" && message.content.trim() &&
      message.createdTimestamp && this.now() - message.createdTimestamp <= this.maxAgeMs);
  }

  isEligible(message, ownBotId) {
    return this.isEnabled(message.channelId) && this.isPeerMessage(message, ownBotId);
  }

  // One model call at a time per channel. Coalesce bursts into the newest
  // message, keep a cooldown between attempts, and never send after OFF or stale messages.
  async observe(message, ownBotId, reply) {
    await this.load();
    if (!this.isEligible(message, ownBotId)) return false;
    const id = message.channelId;
    this.pending.set(id, message);
    if (this.running.has(id)) return true;
    this.running.add(id);
    try {
      while (this.pending.has(id) && this.isEnabled(id)) {
        const candidate = this.pending.get(id);
        this.pending.delete(id);
        if (!this.isEligible(candidate, ownBotId)) continue;
        const elapsed = this.now() - (this.lastAttemptAt.get(id) ?? -Infinity);
        const delay = Math.max(0, this.cooldownMs - elapsed);
        if (delay) await this.sleep(delay);
        if (!this.isEligible(candidate, ownBotId)) continue;
        this.lastAttemptAt.set(id, this.now());
        try {
          await reply(candidate, () => this.isEligible(candidate, ownBotId));
        } catch (error) {
          console.error("[peer-chat] reply failure:", error?.name ?? "unknown");
        }
      }
    } finally {
      this.running.delete(id);
    }
    return true;
  }
}
