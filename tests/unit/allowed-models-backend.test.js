import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;

async function setupDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-allowed-models-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();

  const { createProviderNode } = await import("@/models/index.js");
  const { isModelAllowedBackend } = await import("@/sse/services/model.js");
  const { closeAdapter } = await import("@/lib/localDb");

  return {
    createProviderNode,
    isModelAllowedBackend,
    async cleanup() {
      await closeAdapter();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

describe("allowed models backend matching", () => {
  let cleanup = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    await cleanup();
    cleanup = () => {};
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
  });

  it("allows all models if allowedModels is empty or null", async () => {
    const ctx = await setupDb();
    cleanup = ctx.cleanup;

    expect(await ctx.isModelAllowedBackend(null, "openai", "gpt-4")).toBe(true);
    expect(await ctx.isModelAllowedBackend([], "openai", "gpt-4")).toBe(true);
  });

  it("matches built-in provider alias", async () => {
    const ctx = await setupDb();
    cleanup = ctx.cleanup;

    // e.g. "el/*" should allow "elevenlabs/voice-1" because elevenlabs's alias is el
    expect(await ctx.isModelAllowedBackend(["el/*"], "elevenlabs", "voice-1")).toBe(true);
    // e.g. "cc/*" should allow "claude/claude-3-5-sonnet"
    expect(await ctx.isModelAllowedBackend(["cc/*"], "claude", "claude-3-5-sonnet")).toBe(true);
  });

  it("matches custom provider prefix", async () => {
    const ctx = await setupDb();
    cleanup = ctx.cleanup;

    // Create a custom compatible provider node in DB
    await ctx.createProviderNode({
      id: "openai-compatible-chat-custom123",
      type: "openai-compatible",
      name: "Custom Groq Provider",
      prefix: "groq-custom",
      apiType: "chat",
      baseUrl: "https://api.groq.com/openai/v1",
    });

    // Check if wildcard for prefix "groq-custom/*" allows the raw node ID models
    expect(await ctx.isModelAllowedBackend(
      ["groq-custom/*"],
      "openai-compatible-chat-custom123",
      "llama-3.1-8b"
    )).toBe(true);

    // Check if specific model pattern "groq-custom/llama-3.1-8b" allows it
    expect(await ctx.isModelAllowedBackend(
      ["groq-custom/llama-3.1-8b"],
      "openai-compatible-chat-custom123",
      "llama-3.1-8b"
    )).toBe(true);

    // Check that non-matching model is denied
    expect(await ctx.isModelAllowedBackend(
      ["groq-custom/llama-3.1-8b"],
      "openai-compatible-chat-custom123",
      "mixtral-8x7b"
    )).toBe(false);

    // Check that raw node ID itself can still match if user configured it that way
    expect(await ctx.isModelAllowedBackend(
      ["openai-compatible-chat-custom123/llama-3.1-8b"],
      "openai-compatible-chat-custom123",
      "llama-3.1-8b"
    )).toBe(true);
  });
});
