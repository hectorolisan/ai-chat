# gol-IA-t

Chat con LLMs que se ejecutan 100 % en el navegador (WebLLM + WebGPU). Sin servidor: Next.js con `output: "export"`.

- Modelos: lista en `src/lib/engine.ts` (`MODEL_IDS`), pesos en la Cache API del navegador.
- Conversaciones: IndexedDB (`idb-keyval`), `src/lib/store.ts`.
- Requiere un navegador con WebGPU (p. ej. Chrome o Edge recientes).

```bash
pnpm install
pnpm dev      # desarrollo
pnpm build    # genera ./out, servible en cualquier hosting estático
```
