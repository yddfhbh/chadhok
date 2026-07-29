import fs from "node:fs/promises";
import path from "node:path";

export class ConversationStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.sessions = {};
    this.loaded = false;
    this.loadPromise = null;
    this.saveQueue = Promise.resolve();
  }

  async ensureLoaded() {
    if (this.loaded) {
      return;
    }

    this.loadPromise ??= this.load();
    await this.loadPromise;
  }

  async get(key) {
    await this.ensureLoaded();
    return this.sessions[key] ?? null;
  }

  async set(key, value) {
    await this.ensureLoaded();
    this.sessions[key] = value;
    await this.save();
  }

  async delete(key) {
    await this.ensureLoaded();

    if (!(key in this.sessions)) {
      return false;
    }

    delete this.sessions[key];
    await this.save();
    return true;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.sessions = parsed?.sessions && typeof parsed.sessions === "object"
        ? parsed.sessions
        : {};
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Failed to load conversation store:", error);
      }

      this.sessions = {};
    } finally {
      this.loaded = true;
    }
  }

  async save() {
    this.saveQueue = this.saveQueue
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const payload = {
          version: 1,
          savedAt: new Date().toISOString(),
          sessions: this.sessions,
        };
        await fs.writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      });

    return this.saveQueue;
  }
}
