import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: {},
  keyRecord: { allowedModels: ["__none__"] },
  comboModels: null,
  modelInfo: { provider: "openai", model: "gpt-4" },
  handleBypassRequest: vi.fn(),
  handleComboChat: vi.fn(),
  handleFusionChat: vi.fn(),
  handleChatCore: vi.fn(),
  isModelAllowedBackend: vi.fn(),
  augmentModelsWithCapacityAdapter: vi.fn((models) => models),
}));

vi.mock("open-sse/index.js", () => ({}));
vi.mock("@/sse/services/auth.js", () => ({
  getProviderCredentials: vi.fn(),
  markAccountUnavailable: vi.fn(),
  clearAccountError: vi.fn(),
  extractApiKey: vi.fn(() => "test-key"),
  isValidApiKey: vi.fn(async () => mocks.keyRecord),
}));
vi.mock("@/lib/localDb", () => ({
  getSettings: vi.fn(async () => mocks.settings),
}));
vi.mock("@/sse/services/model.js", () => ({
  getModelInfo: vi.fn(async (modelStr) => {
    if (modelStr === "my-combo") return { provider: null, model: modelStr };
    if (modelStr.includes("/")) {
      const [provider, ...parts] = modelStr.split("/");
      return { provider, model: parts.join("/") };
    }
    return mocks.modelInfo;
  }),
  getComboModels: vi.fn(async (modelStr) => modelStr === "my-combo" ? mocks.comboModels : null),
  isModelAllowedBackend: (...args) => mocks.isModelAllowedBackend(...args),
}));
vi.mock("open-sse/handlers/chatCore.js", () => ({
  handleChatCore: (...args) => mocks.handleChatCore(...args),
}));
vi.mock("@/lib/headroom/detect", () => ({ DEFAULT_HEADROOM_URL: "" }));
vi.mock("@/lib/pxpipe/loader.js", () => ({ getTransform: vi.fn() }));
vi.mock("@/lib/pxpipe/events.js", () => ({ appendPxpipeEvent: vi.fn() }));
vi.mock("open-sse/utils/error.js", () => ({
  errorResponse: (status, message) => new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  }),
  unavailableResponse: (status, message) => new Response(JSON.stringify({ error: { message } }), { status }),
}));
vi.mock("open-sse/services/combo.js", () => ({
  detectRequiredCapabilities: vi.fn(() => new Set()),
  handleComboChat: (...args) => mocks.handleComboChat(...args),
  handleFusionChat: (...args) => mocks.handleFusionChat(...args),
}));
vi.mock("open-sse/services/capacityAdapter.js", () => ({
  augmentModelsWithCapacityAdapter: (...args) => mocks.augmentModelsWithCapacityAdapter(...args),
  withCapacityAdapterStripping: (fn) => fn,
  getActiveAdapterStrategy: vi.fn(() => "fallback"),
}));
vi.mock("open-sse/utils/bypassHandler.js", () => ({
  handleBypassRequest: (...args) => mocks.handleBypassRequest(...args),
}));
vi.mock("@/sse/utils/logger.js", () => ({
  maskKey: vi.fn(() => "***"),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/sse/services/tokenRefresh.js", () => ({
  updateProviderCredentials: vi.fn(),
  checkAndRefreshToken: vi.fn(),
}));
vi.mock("open-sse/services/projectId.js", () => ({ getProjectIdForConnection: vi.fn() }));

function requestFor(model, body = {}) {
  return new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
      "User-Agent": "claude-cli",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Warmup" }],
      stream: false,
      ...body,
    }),
  });
}

describe("chat allowed-model enforcement with bypass, combos, and adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings = {};
    mocks.keyRecord = { allowedModels: ["__none__"] };
    mocks.comboModels = null;
    mocks.modelInfo = { provider: "openai", model: "gpt-4" };
    mocks.isModelAllowedBackend.mockResolvedValue(false);
    mocks.augmentModelsWithCapacityAdapter.mockImplementation((models) => models);
    mocks.handleBypassRequest.mockReturnValue({
      response: new Response(JSON.stringify({ ok: true }), { status: 200 }),
    });
    mocks.handleComboChat.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    mocks.handleFusionChat.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  it("rejects a denied model before returning a synthetic bypass response", async () => {
    const { handleChat } = await import("@/sse/handlers/chat.js");

    const response = await handleChat(requestFor("openai/gpt-4"));

    expect(response.status).toBe(404);
    expect(mocks.handleBypassRequest).not.toHaveBeenCalled();
  });

  it("honors a bare combo-name allowlist entry for original members but not injected adapters", async () => {
    mocks.handleBypassRequest.mockReturnValue(null);
    mocks.keyRecord = { allowedModels: ["my-combo"] };
    mocks.comboModels = ["openai/text-model", "claude/text-model"];
    mocks.augmentModelsWithCapacityAdapter.mockReturnValue([
      "vision/adapter-model",
      "openai/text-model",
      "claude/text-model",
    ]);

    const { handleChat } = await import("@/sse/handlers/chat.js");
    const response = await handleChat(requestFor("my-combo", {
      messages: [{ role: "user", content: "hello" }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.handleComboChat).toHaveBeenCalledTimes(1);
    expect(mocks.handleComboChat.mock.calls[0][0].models).toEqual([
      "openai/text-model",
      "claude/text-model",
    ]);
  });

  it("falls back to an authorized panel model when a configured fusion judge is denied", async () => {
    mocks.handleBypassRequest.mockReturnValue(null);
    mocks.settings = {
      comboStrategies: {
        "my-combo": { fallbackStrategy: "fusion", judgeModel: "judge/denied" },
      },
    };
    mocks.keyRecord = { allowedModels: ["my-combo"] };
    mocks.comboModels = ["openai/panel-a", "claude/panel-b"];

    const { handleChat } = await import("@/sse/handlers/chat.js");
    const response = await handleChat(requestFor("my-combo", {
      messages: [{ role: "user", content: "hello" }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.handleFusionChat).toHaveBeenCalledTimes(1);
    expect(mocks.handleFusionChat.mock.calls[0][0].judgeModel).toBeUndefined();
  });
});
