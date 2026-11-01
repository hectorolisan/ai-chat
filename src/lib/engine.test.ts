import { beforeEach, expect, test, vi } from "vitest";

const mlc = vi.hoisted(() => ({
  create: vi.fn(),
  reload: vi.fn(),
  unload: vi.fn(),
  deleteModelAllInfoInCache: vi.fn(),
}));

vi.mock("@mlc-ai/web-llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mlc-ai/web-llm")>()),
  deleteModelAllInfoInCache: mlc.deleteModelAllInfoInCache,
  WebWorkerMLCEngine: class {
    chat = { completions: { create: mlc.create } };
    reload = mlc.reload;
    unload = mlc.unload;
    setInitProgressCallback() {}
  },
}));

vi.stubGlobal("Worker", class {});

const engine = await import("./engine");

async function* chunks(...cs: object[]) {
  yield* cs;
}

beforeEach(() => vi.clearAllMocks());

test("every curated model exists in prebuiltAppConfig", () => {
  expect(engine.MODELS).toHaveLength(6);
  expect(engine.DEFAULT_MODEL).toBe("Llama-3.2-1B-Instruct-q4f16_1-MLC");
});

test("modelName strips the quantisation suffix", () => {
  expect(engine.modelName("Qwen3-4B-q4f16_1-MLC")).toBe("Qwen3-4B");
  expect(engine.modelName("other-model")).toBe("other-model");
});

test("loadModel skips reload when the model is already loaded", async () => {
  await engine.loadModel("a", () => {});
  await engine.loadModel("a", () => {});
  expect(mlc.reload).toHaveBeenCalledTimes(1);
  expect(engine.loadedModel()).toBe("a");
});

test("loadModel leaves nothing loaded when reload fails", async () => {
  mlc.reload.mockRejectedValueOnce(new Error("oom"));
  await expect(engine.loadModel("b", () => {})).rejects.toThrow("oom");
  expect(engine.loadedModel()).toBeNull();
});

test("deleteCached unloads the model if it is in the GPU", async () => {
  await engine.loadModel("c", () => {});
  await engine.deleteCached("c");
  expect(mlc.unload).toHaveBeenCalled();
  expect(engine.loadedModel()).toBeNull();
  expect(mlc.deleteModelAllInfoInCache).toHaveBeenCalledWith("c");
});

test("streamChat maps deltas, usage and truncation", async () => {
  mlc.create.mockResolvedValue(
    chunks(
      { choices: [{ delta: { content: "Ho" } }] },
      { choices: [{ delta: {}, finish_reason: "length" }] },
      {
        choices: [],
        usage: { completion_tokens: 5, prompt_tokens: 9, extra: { decode_tokens_per_s: 20 } },
      },
    ),
  );

  const out = [];
  for await (const c of engine.streamChat("Llama", [])) out.push(c);

  expect(out).toEqual([
    { delta: "Ho", truncated: false, usage: undefined },
    { delta: "", truncated: true, usage: undefined },
    { delta: "", truncated: false, usage: { tokens: 5, prompt: 9, tps: 20 } },
  ]);
  expect(mlc.create.mock.calls[0][0]).toMatchObject({
    max_tokens: engine.MAX_TOKENS,
    repetition_penalty: 1.1,
  });
  expect(mlc.create.mock.calls[0][0]).not.toHaveProperty("extra_body");
});

test("streamChat disables thinking for Qwen3", async () => {
  mlc.create.mockResolvedValue(chunks());
  for await (const _ of engine.streamChat("Qwen3-4B-q4f16_1-MLC", [])) void _;
  expect(mlc.create.mock.calls[0][0].extra_body).toEqual({ enable_thinking: false });
});
