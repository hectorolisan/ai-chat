"use client";

import { useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import type { InitProgressReport } from "@mlc-ai/web-llm";
import type { Message } from "@/lib/store";
import { modelName } from "@/lib/engine";
import { Goliat } from "@/components/goliat";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Props = {
  message: Message;
  progress: InitProgressReport | null;
  onRetry: () => void;
  canRetry: boolean;
};

export function ChatMessage({ message, progress, onRetry, canRetry }: Props) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-4 py-3 whitespace-pre-wrap text-primary-foreground shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const { status, usage } = message;
  const content = message.content.replace(/^<think>[\s\S]*?<\/think>\s*/, "");
  const finished = status === "done" || status === "stopped" || status === "error";

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex gap-3">
      <Goliat thinking={status === "pending"} className="size-9 shrink-0 rounded-[4px]" />
      <div className="min-w-0 flex-1 pt-1.5">
        {status === "pending" &&
          (progress ? (
            <div className="max-w-sm space-y-2 text-sm text-muted-foreground" aria-live="polite">
              <Progress value={progress.progress * 100} />
              <p className="line-clamp-2 text-xs italic">{progress.text}</p>
            </div>
          ) : (
            <p className="animate-pulse text-sm text-muted-foreground italic">Pensando…</p>
          ))}

        {content && (
          <Streamdown
            plugins={{ code }}
            isAnimating={status === "streaming"}
            caret={status === "streaming" ? "block" : undefined}
          >
            {content}
          </Streamdown>
        )}

        {status === "error" && (
          <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {message.error}
          </p>
        )}

        {finished && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {content && (
              <Button variant="ghost" size="icon-xs" onClick={copy} aria-label="Copiar respuesta">
                {copied ? <Check /> : <Copy />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onRetry}
              disabled={!canRetry}
              aria-label="Regenerar respuesta"
            >
              <RotateCcw />
            </Button>
            <span className="ml-1 truncate italic">
              {message.model && modelName(message.model)}
              {usage && ` · ${usage.tokens} tokens · ${usage.tps.toFixed(1)} tok/s`}
              {status === "stopped" && " · detenido"}
              {message.truncated && " · cortado por límite de tokens"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
