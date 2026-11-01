<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project

**gol-IA-t** is a chat UI for LLMs that run entirely in the browser: WebLLM (`@mlc-ai/web-llm`) on
WebGPU, no backend, no API keys. Next.js 16 static export + React 19 + Tailwind CSS 4 + shadcn/ui.
All visible content is in Spanish. Vitest covers `src/lib` and `use-chat` (`*.test.ts`, engine and store mocked; hook tests use jsdom + `renderHook`); components are untested.

## Commands

pnpm is the package manager (`pnpm-lock.yaml` is committed; npm/bun also work).

- `pnpm install` — install dependencies
- `pnpm dev` — dev server at localhost:3000
- `pnpm build` — static export to `./out/`
- `pnpm lint` — ESLint (`eslint-config-next` core-web-vitals + typescript)
- `pnpm test` — Vitest (`vitest run`; `vitest.config.mts` only maps the `@/` alias, default env is node)

`pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (no package published less than a day ago)
and blocks build scripts for `sharp` / `unrs-resolver` — keep both when adding dependencies.

## Architecture

`src/app/page.tsx` renders `<ChatApp />` (`src/components/chat-app.tsx`), a client component that
owns the whole UI: shadcn `Sidebar` with the conversation list, an empty state (logo, composer,
suggestions) or the message list, and the `Credit` footer. State lives in one hook,
`src/hooks/use-chat.ts`; the model layer is `src/lib/engine.ts`; persistence is `src/lib/store.ts`.

Patterns that span files:

- **No server, ever**: `next.config.ts` sets `output: "export"`. No route handlers, server
  actions, `cookies()`, ISR or `next/image` optimisation — anything that needs a Node runtime
  breaks the build. Everything stateful is a client component.
- **Engine in a Web Worker**: `engine.ts` lazily creates one `WebWorkerMLCEngine` backed by
  `engine.worker.ts`, so inference never blocks the main thread. It tracks the loaded model in a
  module-level `loaded`; `loadModel()` is a no-op when the requested model is already in the GPU.
  Weights live in the browser Cache API (`hasModelInCache` / `deleteModelAllInfoInCache`).
- **Model list is curated**: `MODEL_IDS` in `engine.ts` picks entries from WebLLM's
  `prebuiltAppConfig` — each was checked for coherent Spanish and correct code; the comment above
  it lists the ones dropped and why. All are `q4f16_1`, which `modelName()` strips for display and
  `ModelInfo` describes. To add a model, use an exact `model_id` from `prebuiltAppConfig` (the
  `.filter` silently drops unknown ids) and test it in Spanish first.
- **Generation defaults** (`streamChat`): `max_tokens: MAX_TOKENS` (1024) and
  `repetition_penalty: 1.1` because small models fall into loops; Qwen3 gets
  `enable_thinking: false`, and `ChatMessage` still strips a leading `<think>…</think>` in case a
  model emits one. A `finish_reason` of `"length"` marks the message `truncated`.
- **Chat flow** (`use-chat.ts`): `send()` is optimistic — the user message and a `pending`
  assistant message render before the model loads. `generate()` loads the model (reporting
  `InitProgressReport` to the pending bubble), sends only the last `HISTORY_LIMIT` (12) non-error
  messages, and streams deltas into the message via `patch()`. Status goes
  `pending → streaming → done | stopped | error`. `stop()` sets a ref and calls
  `interruptGenerate()`; `retry()` regenerates in place with the currently selected model.
- **Persistence**: conversations are one array under the `conversations` key in IndexedDB
  (`idb-keyval`), saved with a 400 ms debounce once hydrated. `loadConversations()` turns any
  message left `pending`/`streaming` by a reload into `stopped`. There is no schema version — if
  `Message` or `Conversation` change shape, handle old records in `loadConversations()`.
- **Composer + model info**: the model `Select` marks cached models (re-checked after every
  generation) and can delete the current model from the cache. `ModelInfo` shows context usage
  (prompt + completion tokens of the last reply vs `context_window_size`), VRAM, `shader-f16`
  support and the GPU adapter; `lib.dom` has no WebGPU types, so it declares the minimal `Gpu`
  shape it reads. `hasWebGPU()` gates the composer and shows a `NoWebGPU` notice.
- **SSR-safe browser checks**: `chat-app.tsx` reads `hasWebGPU` and the `lg` media query through
  `useSyncExternalStore` with a server snapshot of `true`, so the static HTML matches the first
  client render. Don't read `navigator`/`matchMedia` during render any other way.
- **Design tokens**: Tailwind 4 with no `tailwind.config` — everything is in
  `src/app/globals.css`. shadcn's CSS variables are mapped onto the hectorolisan brand
  (`--brand` `#333b4b`, `--ink`, `--chat`, `accent-gray` `#bcc0c7`). Dark mode follows
  `prefers-color-scheme` only (`@custom-variant dark`), no toggle. Fonts: Poppins (`font-sans`),
  Bricolage Grotesque 800 (`font-heading`, h1–h3 and Streamdown headings — that rule is
  unlayered on purpose to beat Streamdown's utilities), Geist Mono (`font-mono`). `labelClass` in
  `src/lib/utils.ts` is the brand section label. Use these tokens, not hardcoded colours.
- **Streamdown**: assistant messages render with `<Streamdown plugins={{ code }}>`. Its classes
  only exist because `globals.css` has `@source` lines pointing into `node_modules/streamdown` and
  `@streamdown/code` — keep them if you touch the imports.
- **shadcn/ui**: `src/components/ui/` is generated (`radix-nova` style, lucide icons, see
  `components.json`); add components with the shadcn CLI rather than hand-writing them. `cn` comes
  from the `cn` package, re-exported from `src/lib/utils.ts`.
- **Goliat logo** (`components/goliat.tsx`): pixel art inlined as SVG paths generated from
  `public/goliat.svg`; `thinking` cycles extra frames (speech bubble, blink) while a reply is
  pending. Don't hand-edit the path data.
- **Shortcuts**: `Ctrl/Cmd+Shift+O` opens a new chat (Shift+N is the browser's incognito) and
  `Ctrl+B` toggles the sidebar (shadcn default).
