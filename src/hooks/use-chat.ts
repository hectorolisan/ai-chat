"use client";

import { useEffect, useRef, useState } from "react";
import type { InitProgressReport } from "@mlc-ai/web-llm";
import { DEFAULT_MODEL, loadModel, stopGeneration, streamChat } from "@/lib/engine";
import {
  loadConversations,
  saveConversations,
  type Conversation,
  type Message,
} from "@/lib/store";

// shortcut: only the last N messages go to the model, upgrade to token-based trimming if context errors appear.
export const HISTORY_LIMIT = 12;

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [progress, setProgress] = useState<InitProgressReport | null>(null);
  const [busy, setBusy] = useState(false);
  const stopped = useRef(false);

  useEffect(() => {
    loadConversations().then((list) => {
      setConversations(list);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => saveConversations(conversations), 400);
    return () => clearTimeout(t);
  }, [conversations, hydrated]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const patch = (convId: string, msgId: string, fn: (m: Message) => Message) =>
    setConversations((cs) =>
      cs.map((c) =>
        c.id !== convId
          ? c
          : {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)),
            },
      ),
    );

  async function generate(convId: string, history: Message[], msgId: string) {
    setBusy(true);
    stopped.current = false;
    try {
      await loadModel(model, setProgress);
      setProgress(null);
      if (stopped.current) return patch(convId, msgId, (m) => ({ ...m, status: "stopped" }));

      const messages = history
        .filter((m) => m.status !== "error" && m.content)
        .slice(-HISTORY_LIMIT)
        .map(({ role, content }) => ({ role, content }));

      for await (const { delta, usage, truncated } of streamChat(model, messages)) {
        patch(convId, msgId, (m) => ({
          ...m,
          status: "streaming",
          content: m.content + delta,
          usage: usage ?? m.usage,
          truncated: truncated || m.truncated,
        }));
      }
      patch(convId, msgId, (m) => ({ ...m, status: stopped.current ? "stopped" : "done" }));
    } catch (e) {
      setProgress(null);
      patch(convId, msgId, (m) => ({
        ...m,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy(false);
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (busy || !content) return;

    const user: Message = { id: crypto.randomUUID(), role: "user", content, status: "done" };
    const reply: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "pending",
      model,
    };
    const convId = active?.id ?? crypto.randomUUID();
    const history = [...(active?.messages ?? []), user];

    // Optimistic: both messages render before the model is even loaded.
    setConversations((cs) => [
      {
        id: convId,
        title: active?.title ?? content.slice(0, 48),
        messages: [...history, reply],
        updatedAt: Date.now(),
      },
      ...cs.filter((c) => c.id !== convId),
    ]);
    setActiveId(convId);
    generate(convId, history, reply.id);
  }

  function retry(msgId: string) {
    if (busy || !active) return;
    const i = active.messages.findIndex((m) => m.id === msgId);
    patch(active.id, msgId, (m) => ({
      ...m,
      content: "",
      status: "pending",
      error: undefined,
      usage: undefined,
      truncated: undefined,
      model,
    }));
    generate(active.id, active.messages.slice(0, i), msgId);
  }

  function stop() {
    stopped.current = true;
    stopGeneration();
  }

  function remove(id: string) {
    if (busy && id === activeId) stop();
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (id === activeId) setActiveId(null);
  }

  return {
    conversations,
    hydrated,
    active,
    select: setActiveId,
    newChat: () => setActiveId(null),
    remove,
    send,
    retry,
    stop,
    model,
    setModel,
    progress,
    busy,
  };
}
