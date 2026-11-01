import { get, set } from "idb-keyval";
import type { Usage } from "./engine";

export type MessageStatus = "pending" | "streaming" | "done" | "stopped" | "error";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  model?: string;
  usage?: Usage;
  truncated?: boolean;
  error?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const KEY = "conversations";

export async function loadConversations(): Promise<Conversation[]> {
  const list = (await get<Conversation[]>(KEY)) ?? [];
  // A reload mid-generation leaves messages in-flight; mark them stopped.
  return list.map((c) => ({
    ...c,
    messages: c.messages.map((m) =>
      m.status === "pending" || m.status === "streaming" ? { ...m, status: "stopped" } : m,
    ),
  }));
}

export const saveConversations = (list: Conversation[]) => set(KEY, list);
