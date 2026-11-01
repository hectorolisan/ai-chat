"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Square, Trash2 } from "lucide-react";
import { MODELS, deleteCached, isCached, modelName, type Usage } from "@/lib/engine";
import { ModelInfo } from "@/components/model-info";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

async function cachedIds() {
  const hits = await Promise.all(MODELS.map((m) => isCached(m.model_id)));
  return new Set(MODELS.filter((_, i) => hits[i]).map((m) => m.model_id));
}

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  model: string;
  onModelChange: (id: string) => void;
  usage?: Usage;
  tokens: number;
  infoSide?: "top" | "right";
};

export function Composer({
  onSend,
  onStop,
  busy,
  disabled,
  model,
  onModelChange,
  usage,
  tokens,
  infoSide,
}: Props) {
  const [text, setText] = useState("");
  const [cached, setCached] = useState<Set<string>>(new Set());

  // Re-check after each generation: a model may have just been downloaded.
  useEffect(() => {
    if (!busy) cachedIds().then(setCached);
  }, [busy]);

  function submit() {
    if (busy || disabled || !text.trim()) return;
    onSend(text);
    setText("");
  }

  async function removeCache() {
    if (!confirm(`¿Borrar ${modelName(model)} de la caché del navegador?`)) return;
    await deleteCached(model);
    setCached(await cachedIds());
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="@container rounded-lg border bg-card p-3 shadow-sm focus-within:ring-3 focus-within:ring-ring/30"
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Pregunta lo que quieras…"
        aria-label="Mensaje"
        disabled={disabled}
        className="max-h-52 min-h-12 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="mt-2 flex items-center gap-1">
        <Select value={model} onValueChange={onModelChange} disabled={busy}>
          <SelectTrigger size="sm" className="max-w-56 min-w-0 shrink" aria-label="Modelo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" side="top" align="start">
            {MODELS.map((m) => (
              <SelectItem key={m.model_id} value={m.model_id}>
                <span
                  className={`size-1.5 shrink-0 ${cached.has(m.model_id) ? "bg-primary" : "bg-accent-gray"}`}
                  aria-label={cached.has(m.model_id) ? "En caché" : "No descargado"}
                />
                {modelName(m.model_id)}
                <span className="text-xs text-muted-foreground">
                  {((m.vram_required_MB ?? 0) / 1024).toFixed(1)} GB
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ModelInfo model={model} usage={usage} side={infoSide} />

        {cached.has(model) && !busy && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={removeCache}
                aria-label="Borrar modelo de la caché"
              >
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Borrar modelo de la caché</TooltipContent>
          </Tooltip>
        )}

        <span className="ml-auto hidden shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums @lg:inline">
          {tokens.toLocaleString("es")} tokens
        </span>
        {busy ? (
          <Button type="button" size="icon" className="ml-auto @lg:ml-0" onClick={onStop} aria-label="Detener">
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon" className="ml-auto @lg:ml-0" disabled={disabled || !text.trim()} aria-label="Enviar">
            <ArrowUp />
          </Button>
        )}
      </div>
    </form>
  );
}
