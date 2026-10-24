import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PeerChat } from "../src/peer-chat.js";
import { handleCommand, definitions } from "../src/commands.js";

const GUILD = "1009121661209034762";
const CHANNEL = "156999999999999991";
const PEER = "1561276856517529620";
const CHADHOK = "156999999999999993";
const OWNER = "635107514471415808";
const OTHER = "156999999999999995";

const message = (opts = {}) => ({
  guildId: GUILD, channelId: CHANNEL,
  author: { id: PEER, bot: true },
  webhookId: null, content: "안녕 브로", createdTimestamp: Date.now(),
  ...opts,
});

async function fixture(fn, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "chadhok-peer-test-"));
  try {
    const filePath = join(dir, "peer-chat.json");
    const peer = new PeerChat({ filePath, guildId: GUILD, peerIds: [PEER],
      ownerId: OWNER, cooldownMs: 0, ...options });
    await fn(peer, filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("peer chat is OFF by default and never reads unknown bots, self, webhooks, humans or other guilds", async () => {
  await fixture(async peer => {
    assert.equal(await peer.observe(message(), CHADHOK, async () => true), false);
    await peer.setEnabled(CHANNEL, true);
    for (const invalid of [
      { author: { id: OTHER, bot: true } },
      { author: { id: CHADHOK, bot: true } },
      { author: { id: PEER, bot: false } },
      { webhookId: "123" },
      { guildId: OTHER },
      { createdTimestamp: Date.now() - 120000 },
      { content: "" },
    ]) {
      assert.equal(peer.isEligible(message(invalid), CHADHOK), false);
    }
    assert.equal(peer.isEligible(message(), CHADHOK), true);
  });
});

test("enabled channels persist, OFF while generating prevents late sends", async () => {
  await fixture(async (peer, filePath) => {
    await peer.setEnabled(CHANNEL, true);
    const loaded = new PeerChat({ filePath, guildId: GUILD, peerIds: [PEER], ownerId: OWNER, cooldownMs: 0 });
    await loaded.load();
    assert.equal(loaded.isEnabled(CHANNEL), true);
    let release;
    const pending = peer.observe(message(), CHADHOK, async (_msg, canSend) => {
      await new Promise(resolve => { release = resolve; });
      return canSend();
    });
    while (!release) await new Promise(resolve => setImmediate(resolve));
    await peer.setEnabled(CHANNEL, false);
    release();
    await pending;
    assert.equal(peer.isEnabled(CHANNEL), false);
    const next = new PeerChat({ filePath, guildId: GUILD });
    await next.load();
    assert.equal(next.isEnabled(CHANNEL), false);
  });
});

test("peer chat coalesces bursts and remains enabled after more than 60 automatic replies", async () => {
  await fixture(async (peer, filePath) => {
    await peer.setEnabled(CHANNEL, true);
    let release;
    const observed = [];
    const first = peer.observe(message({ id: "one" }), CHADHOK, async msg => {
      observed.push(msg.id);
      if (msg.id === "one") await new Promise(resolve => { release = resolve; });
      return true;
    });
    while (!release) await new Promise(resolve => setImmediate(resolve));
    await peer.observe(message({ id: "two" }), CHADHOK, async () => true);
    await peer.observe(message({ id: "three" }), CHADHOK, async () => true);
    release();
    await first;
    assert.deepEqual(observed, ["one", "three"]);

    for (let i = 0; i < 75; i++) {
      await peer.observe(message({ id: "next-" + i }), CHADHOK, async msg => {
        observed.push(msg.id);
        return true;
      });
    }
    assert.equal(observed.length, 77);
    assert.equal(peer.isEnabled(CHANNEL), true);
    const restarted = new PeerChat({ filePath, guildId: GUILD, peerIds: [PEER] });
    await restarted.load();
    assert.equal(restarted.isEnabled(CHANNEL), true);
    // The explicit OFF command is still authoritative.
    await peer.setEnabled(CHANNEL, false);
    assert.equal(peer.isEnabled(CHANNEL), false);
  });
});

test("configurable 3-second cooldown applies between peer model starts without delaying the first turn", async () => {
  let clock = Date.now();
  const waits = [];
  await fixture(async peer => {
    await peer.setEnabled(CHANNEL, true);
    const started = [];
    for (let i = 0; i < 3; i++) {
      await peer.observe(message({ id: "clock-" + i, createdTimestamp: clock }), CHADHOK, async () => {
        started.push(clock);
        return true;
      });
    }
    assert.deepEqual(waits, [3000, 3000]);
    assert.equal(started.length, 3);
    assert.equal(started[1] - started[0], 3000);
    assert.equal(started[2] - started[1], 3000);
    assert.equal(peer.isEnabled(CHANNEL), true);
  }, {
    cooldownMs: 3000,
    now: () => clock,
    sleep: async ms => {
      waits.push(ms);
      clock += ms;
    }
  });
});

function interaction({ name = "말하기", userId = OWNER, isAdmin = false,
                       guildId = GUILD, text = "안녕, 브로 ㅋㅋ", mode = "on" } = {}) {
  const calls = [];
  const sent = [];
  return {
    commandName: name, isChatInputCommand: () => true,
    guildId, channelId: CHANNEL,
    channel: { isTextBased: () => true, isDMBased: () => false,
      send: async payload => { sent.push(payload); return { id: OTHER }; } },
    user: { id: userId },
    memberPermissions: { has: () => isAdmin },
    options: { getString: key => key === "내용" ? text : mode },
    reply: async payload => { calls.push({ type: "reply", ...payload }); },
    deferReply: async payload => { calls.push({ type: "defer", ...payload }); },
    editReply: async payload => { calls.push({ type: "edit", ...payload }); },
    deleteReply: async () => { calls.push({ type: "delete" }); },
    sent, calls,
  };
}

test("/말하기 posts ordinary bot text, hides command response and prevents mentions", async () => {
  await fixture(async peer => {
    const i = interaction({ text: "@everyone hello" });
    assert.equal(await handleCommand(i, { peerChat: peer, ownerId: OWNER }), true);
    assert.deepEqual(i.sent, [{ content: "@everyone hello", allowedMentions: { parse: [] } }]);
    assert.deepEqual(i.calls.map(c => c.type), ["defer", "delete"]);
    const forbidden = interaction({ userId: OTHER, isAdmin: true });
    await handleCommand(forbidden, { peerChat: peer, ownerId: OWNER });
    assert.equal(forbidden.calls[0].ephemeral, true);
    assert.equal(forbidden.sent.length, 0);
  });
});

test("/봇대화 authorization is restricted and state is independent per channel", async () => {
  await fixture(async peer => {
    assert.deepEqual(definitions.map(c => c.name), ["말하기", "봇대화"]);
    const deny = interaction({ name: "봇대화", userId: OTHER });
    await handleCommand(deny, { peerChat: peer, ownerId: OWNER });
    assert.equal(deny.calls[0].ephemeral, true);
    assert.equal(peer.isEnabled(CHANNEL), false);
    const on = interaction({ name: "봇대화", userId: OTHER, isAdmin: true });
    await handleCommand(on, { peerChat: peer, ownerId: OWNER });
    assert.equal(peer.isEnabled(CHANNEL), true);
    const off = interaction({ name: "봇대화", mode: "off" });
    await handleCommand(off, { peerChat: peer, ownerId: OWNER });
    assert.equal(peer.isEnabled(CHANNEL), false);
  });
});

test("human replying to Chadhok's real message is recognized without an @mention", async () => {
  process.env.DISCORD_TOKEN ||= "test-discord-token";
  process.env.GEMINI_API_KEYS ||= "test-key";
  const { classifyMessage } = await import("../src/gemini-client.js");
  const fake = {
    content: "이어가자 브로",
    attachments: { size: 0 },
    mentions: { has: () => false },
    guildId: GUILD,
    reference: { messageId: OTHER },
    fetchReference: async () => ({ author: { id: CHADHOK } }),
  };
  assert.deepEqual(await classifyMessage(fake, CHADHOK),
    { type: "chat", trigger: "reply" });
  fake.fetchReference = async () => ({ author: { id: PEER } });
  assert.deepEqual(await classifyMessage(fake, CHADHOK), { type: "ignore" });
});
