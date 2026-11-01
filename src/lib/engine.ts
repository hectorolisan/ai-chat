import {
  WebWorkerMLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
  prebuiltAppConfig,
  type ChatCompletionMessageParam,
  type InitProgressReport,
} from "@mlc-ai/web-llm";

// Checked for coherent Spanish + correct code (Intel iGPU and RTX 5060).
// Dropped: Phi-3.5-mini (garbled), Qwen2.5-Coder-1.5B (nonsense prose).
const MODEL_IDS = [
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Qwen3-1.7B-q4f16_1-MLC",
  "gemma-2-2b-it-q4f16_1-MLC",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  "Qwen3-4B-q4f16_1-MLC",
  "Llama-3.1-8B-Instruct-q4f16_1-MLC",
];

export const MODELS = MODEL_IDS.map((id) =>
  prebuiltAppConfig.model_list.find((m) => m.model_id === id),
).filter((m) => m !== undefined);

export const DEFAULT_MODEL = MODELS[0].model_id;

export const modelName = (id: string) => id.replace(/-q4f16_1-MLC$/, "");

export const hasWebGPU = () => typeof navigator !== "undefined" && "gpu" in navigator;

let engine: WebWorkerMLCEngine | null = null;
let loaded: string | null = null;

function getEngine() {
  engine ??= new WebWorkerMLCEngine(
    new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" }),
  );
  return engine;
}

export async function loadModel(id: string, onProgress: (r: InitProgressReport) => void) {
  if (loaded === id) return;
  const e = getEngine();
  e.setInitProgressCallback(onProgress);
  loaded = null;
  await e.reload(id);
  loaded = id;
}

export type Usage = { tokens: number; prompt?: number; tps: number };

export const MAX_TOKENS = 1024;

export async function* streamChat(
  model: string,
  messages: ChatCompletionMessageParam[],
): AsyncGenerator<{ delta: string; usage?: Usage; truncated?: boolean }> {
  const chunks = await getEngine().chat.completions.create({
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    // Small models fall into repetition loops; cap length and penalize repeats.
    max_tokens: MAX_TOKENS,
    repetition_penalty: 1.1,
    // Qwen3 thinks by default; skip it for snappier chat.
    ...(model.startsWith("Qwen3") && { extra_body: { enable_thinking: false } }),
  });
  for await (const c of chunks) {
    yield {
      delta: c.choices[0]?.delta.content ?? "",
      truncated: c.choices[0]?.finish_reason === "length",
      usage: c.usage && {
        tokens: c.usage.completion_tokens,
        prompt: c.usage.prompt_tokens,
        tps: c.usage.extra.decode_tokens_per_s,
      },
    };
  }
}

export const loadedModel = () => loaded;

export const stopGeneration = () => engine?.interruptGenerate();

export const isCached = (id: string) => hasModelInCache(id);

export async function deleteCached(id: string) {
  if (loaded === id) {
    await engine?.unload();
    loaded = null;
  }
  await deleteModelAllInfoInCache(id);
}
