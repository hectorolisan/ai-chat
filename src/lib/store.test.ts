import { beforeEach, expect, test, vi } from "vitest";
import { loadConversations, saveConversations, type Conversation } from "./store";

const db = vi.hoisted(() => new Map<string, unknown>());

vi.mock("idb-keyval", () => ({
  get: async (k: string) => db.get(k),
  set: async (k: string, v: unknown) => void db.set(k, v),
}));

beforeEach(() => db.clear());

test("returns empty list when nothing is stored", async () => {
  expect(await loadConversations()).toEqual([]);
});

test("marks in-flight messages as stopped and keeps the rest", async () => {
  const conv: Conversation = {
    id: "c",
    title: "t",
    updatedAt: 1,
    messages: [
      { id: "1", role: "user", content: "hola", status: "done" },
      { id: "2", role: "assistant", content: "", status: "pending" },
      { id: "3", role: "assistant", content: "a", status: "streaming" },
      { id: "4", role: "assistant", content: "", status: "error", error: "x" },
    ],
  };
  await saveConversations([conv]);

  const [loaded] = await loadConversations();
  expect(loaded.messages.map((m) => m.status)).toEqual(["done", "stopped", "stopped", "error"]);
  expect(loaded.messages[2].content).toBe("a");
});
