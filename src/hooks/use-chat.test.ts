// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Conversation, Message } from "@/lib/store";
import { HISTORY_LIMIT, useChat } from "./use-chat";

const m = vi.hoisted(() => ({
  loadModel: vi.fn(),
  streamChat: vi.fn(),
  stopGeneration: vi.fn(),
  loadConversations: vi.fn(),
  saveConversations: vi.fn(),
}));

vi.mock("@/lib/engine", () => ({
  DEFAULT_MODEL: "m1",
  loadModel: m.loadModel,
  streamChat: m.streamChat,
  stopGeneration: m.stopGeneration,
}));

vi.mock("@/lib/store", () => ({
  loadConversations: m.loadConversations,
  saveConversations: m.saveConversations,
}));

async function* reply(...deltas: string[]) {
  for (const delta of deltas) yield { delta };
}

const msg = (i: number, extra: Partial<Message> = {}): Message => ({
  id: String(i),
  role: i % 2 ? "assistant" : "user",
  content: `m${i}`,
  status: "done",
  ...extra,
});

async function setup(stored: Conversation[] = []) {
  m.loadConversations.mockResolvedValue(stored);
  const hook = renderHook(() => useChat());
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook.result;
}

const last = (r: { current: ReturnType<typeof useChat> }) => r.current.active?.messages.at(-1);

beforeEach(() => {
  vi.clearAllMocks();
  m.loadModel.mockResolvedValue(undefined);
  m.streamChat.mockImplementation(() => reply("Ho", "la"));
});

afterEach(cleanup);

test("hydrates from the store and saves changes after the debounce", async () => {
  const conv: Conversation = { id: "c", title: "t", updatedAt: 1, messages: [msg(0)] };
  const r = await setup([conv]);
  expect(r.current.conversations).toEqual([conv]);

  act(() => r.current.send("hola"));
  await waitFor(() => expect(m.saveConversations).toHaveBeenCalled());
  expect(m.saveConversations.mock.lastCall?.[0]).toHaveLength(2);
});

test("send creates a conversation and streams the reply", async () => {
  const r = await setup();
  m.streamChat.mockImplementation(async function* () {
    yield { delta: "Ho" };
    yield { delta: "la", truncated: true, usage: { tokens: 2, prompt: 3, tps: 9 } };
  });

  act(() => r.current.send(`  ${"x".repeat(60)}  `));
  expect(r.current.active?.title).toBe("x".repeat(48));
  expect(last(r)).toMatchObject({ role: "assistant", status: "pending", model: "m1" });

  await waitFor(() => expect(last(r)?.status).toBe("done"));
  expect(last(r)).toMatchObject({
    content: "Hola",
    truncated: true,
    usage: { tokens: 2, prompt: 3, tps: 9 },
  });
  expect(r.current.active?.messages[0]).toMatchObject({ role: "user", content: "x".repeat(60) });
  expect(r.current.busy).toBe(false);
  expect(m.loadModel).toHaveBeenCalledWith("m1", expect.any(Function));
});

test("send ignores blank text and calls made while busy", async () => {
  const r = await setup();
  act(() => r.current.send("   "));
  expect(r.current.conversations).toEqual([]);

  act(() => r.current.send("uno"));
  expect(r.current.busy).toBe(true);
  act(() => r.current.send("dos"));
  await waitFor(() => expect(r.current.busy).toBe(false));
  expect(r.current.active?.messages.map((x) => x.content)).toEqual(["uno", "Hola"]);
});

test("only the last HISTORY_LIMIT non-error messages reach the model", async () => {
  const messages = Array.from({ length: 15 }, (_, i) => msg(i));
  messages[13] = msg(13, { status: "error", content: "" });
  const r = await setup([{ id: "c", title: "t", updatedAt: 1, messages }]);

  act(() => r.current.select("c"));
  act(() => r.current.send("nuevo"));
  await waitFor(() => expect(last(r)?.status).toBe("done"));

  const sent = m.streamChat.mock.calls[0][1];
  expect(sent).toHaveLength(HISTORY_LIMIT);
  expect(sent.at(-1)).toEqual({ role: "user", content: "nuevo" });
  expect(sent.some((x: { content: string }) => x.content === "")).toBe(false);
});

test("a failed model load marks the reply as error", async () => {
  const r = await setup();
  m.loadModel.mockRejectedValue(new Error("sin VRAM"));

  act(() => r.current.send("hola"));
  await waitFor(() => expect(last(r)?.status).toBe("error"));
  expect(last(r)?.error).toBe("sin VRAM");
  expect(r.current.busy).toBe(false);
});

test("stop interrupts generation and marks the reply as stopped", async () => {
  const r = await setup();
  let release!: () => void;
  m.streamChat.mockImplementation(async function* () {
    yield { delta: "a" };
    await new Promise<void>((res) => (release = res));
  });

  act(() => r.current.send("hola"));
  await waitFor(() => expect(last(r)?.status).toBe("streaming"));
  act(() => r.current.stop());
  expect(m.stopGeneration).toHaveBeenCalled();

  await act(async () => release());
  await waitFor(() => expect(last(r)?.status).toBe("stopped"));
  expect(last(r)?.content).toBe("a");
});

test("retry regenerates the reply in place with the history before it", async () => {
  const r = await setup([
    {
      id: "c",
      title: "t",
      updatedAt: 1,
      messages: [msg(0), msg(1, { status: "error", error: "x", model: "old" })],
    },
  ]);

  act(() => r.current.select("c"));
  act(() => r.current.retry("1"));
  expect(last(r)).toMatchObject({ status: "pending", content: "", error: undefined, model: "m1" });

  await waitFor(() => expect(last(r)?.status).toBe("done"));
  expect(r.current.active?.messages).toHaveLength(2);
  expect(last(r)?.content).toBe("Hola");
  expect(m.streamChat.mock.calls[0][1]).toEqual([{ role: "user", content: "m0" }]);
});

test("removing the active conversation clears the selection", async () => {
  const r = await setup([{ id: "c", title: "t", updatedAt: 1, messages: [msg(0)] }]);
  act(() => r.current.select("c"));
  act(() => r.current.remove("c"));
  expect(r.current.active).toBeNull();
  expect(r.current.conversations).toEqual([]);
});
