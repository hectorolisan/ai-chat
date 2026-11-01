"use client";

import { useState } from "react";
import { ExternalLink, Info } from "lucide-react";
import { HISTORY_LIMIT } from "@/hooks/use-chat";
import { MODELS, isCached, loadedModel, modelName, type Usage } from "@/lib/engine";
import { cn, labelClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// lib.dom has no WebGPU types yet; only what we read.
type Gpu = {
  requestAdapter(): Promise<{
    info: { vendor: string; architecture: string };
    features: Set<string>;
  } | null>;
};

type Details = { cached: boolean; gpu: string; f16: boolean };

type Props = { model: string; usage?: Usage; side?: "top" | "right" };

export function ModelInfo({ model, usage, side = "top" }: Props) {
  const [details, setDetails] = useState<Details | null>(null);
  const record = MODELS.find((m) => m.model_id === model);
  const ctx = record?.overrides?.context_window_size;
  const used = usage ? (usage.prompt ?? 0) + usage.tokens : 0;
  const pct = ctx ? Math.min(100, (used / ctx) * 100) : 0;
  const required = record?.required_features ?? [];

  async function onOpenChange(open: boolean) {
    if (!open) return;
    setDetails(null);
    const gpu = (navigator as Navigator & { gpu?: Gpu }).gpu;
    const [cached, adapter] = await Promise.all([isCached(model), gpu?.requestAdapter() ?? null]);
    setDetails({
      cached,
      gpu: adapter ? `${adapter.info.vendor} ${adapter.info.architecture}`.trim() : "—",
      f16: !!adapter?.features.has("shader-f16"),
    });
  }

  const status =
    loadedModel() === model
      ? "Cargado en la GPU"
      : details?.cached
        ? "En caché"
        : details
          ? "No descargado"
          : "…";

  const rows: [string, string][] = [
    ["Estado", status],
    ["Ventana de contexto", ctx ? `${ctx.toLocaleString("es")} tokens` : "—"],
    ["VRAM estimada", record?.vram_required_MB ? `${(record.vram_required_MB / 1024).toFixed(2)} GB` : "—"],
    ["Cuantización", model.includes("q4f16") ? "q4f16 · pesos 4 bits, cálculo f16" : "—"],
    ["Bajos recursos", record?.low_resource_required ? "Sí" : "No"],
    [
      "shader-f16",
      `${required.includes("shader-f16") ? "Requerido" : "No requerido"}${details ? ` · GPU ${details.f16 ? "compatible" : "no compatible"}` : ""}`,
    ],
    ["GPU", details?.gpu ?? "…"],
    ["Última velocidad", usage ? `${usage.tps.toFixed(1)} tok/s` : "—"],
  ];

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label="Información del modelo">
          <ContextRing pct={pct} />
          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(pct)}%</span>
          <Info />
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} align={side === "top" ? "start" : "center"} className="w-[22rem] max-w-[calc(100vw-2rem)] gap-4">
        <div className="space-y-1.5">
          <p className={labelClass}>WebLLM · WebGPU</p>
          <h3 className="text-xl leading-[26px] break-words">{modelName(model)}</h3>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className={cn(labelClass, "flex items-center gap-2")}>
              <span className="size-1.5 bg-accent-gray" aria-hidden />
              Contexto
            </span>
            <span className="text-muted-foreground tabular-nums">
              {used.toLocaleString("es")} / {ctx?.toLocaleString("es") ?? "—"} tokens
            </span>
          </div>
          <Progress value={pct} aria-label="Uso de contexto" />
          <p className="text-xs text-muted-foreground italic">
            Según la última respuesta. Se envían como máximo los últimos {HISTORY_LIMIT} mensajes.
          </p>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>

        {record && (
          <a
            href={record.model}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground italic underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver en Hugging Face <ExternalLink className="size-3" />
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ContextRing({ pct }: { pct: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className="size-4 -rotate-90" aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        className="stroke-primary"
      />
    </svg>
  );
}
