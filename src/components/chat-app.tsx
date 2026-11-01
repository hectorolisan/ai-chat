"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { hasWebGPU } from "@/lib/engine";
import type { Conversation, Message } from "@/lib/store";
import { ChatMessage } from "@/components/chat-message";
import { Composer } from "@/components/composer";
import { Credit } from "@/components/credit";
import { Goliat } from "@/components/goliat";
import { cn, labelClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NO_MESSAGES: Message[] = [];

// Desktop (lg): room to open the model info popover to the right.
const WIDE_QUERY = "(min-width: 1024px)";
function subscribeWide(cb: () => void) {
  const mql = matchMedia(WIDE_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

const SUGGESTIONS = [
  "Explícame qué es WebGPU en tres frases",
  "Escribe una función TypeScript que agrupe un array por clave",
  "Dame una tabla comparando REST y GraphQL",
];

export function ChatApp() {
  const chat = useChat();
  const gpu = useSyncExternalStore(() => () => {}, hasWebGPU, () => true);
  const wide = useSyncExternalStore(subscribeWide, () => matchMedia(WIDE_QUERY).matches, () => true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = chat.active?.messages ?? NO_MESSAGES;
  const lastCount = useRef(0);

  // Follow the stream unless the user scrolled up; always jump on a new message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (messages.length !== lastCount.current || nearBottom) el.scrollTop = el.scrollHeight;
    lastCount.current = messages.length;
  }, [messages]);

  // Ctrl+Shift+N is reserved by the browser (incognito), so O like ChatGPT/Gemini.
  const { newChat } = chat;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyO") {
        e.preventDefault();
        newChat();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newChat]);

  const tokens = messages.reduce((n, m) => n + (m.usage?.tokens ?? 0), 0);
  const lastUsage = messages.findLast((m) => m.usage)?.usage;

  const composerProps = {
    onSend: chat.send,
    onStop: chat.stop,
    busy: chat.busy,
    disabled: !gpu,
    model: chat.model,
    onModelChange: chat.setModel,
    usage: lastUsage,
    tokens,
  };

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as CSSProperties}>
      <ChatSidebar
        conversations={chat.conversations}
        activeId={chat.active?.id ?? null}
        onSelect={chat.select}
        onNew={chat.newChat}
        onRemove={chat.remove}
      />
      <SidebarInset className="bg-chat h-svh overflow-hidden">
        <OpenSidebarTrigger />

        {messages.length === 0 ? (
          <div className="@container flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-[10vh]">
            <div className="flex w-full max-w-3xl flex-col gap-6">
              <h2 className="flex flex-col items-center justify-center gap-3 text-center text-[28px] leading-8 @xl:flex-row @xl:text-[36px] @xl:leading-10">
                <Goliat className="size-10 shrink-0" />
                ¿En qué puedo ayudarte?
              </h2>
              {!gpu && <NoWebGPU />}
              <Composer {...composerProps} infoSide={wide ? "right" : "top"} />
              <div className="flex flex-col items-start px-2">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s}
                    variant="ghost"
                    size="sm"
                    className="h-auto max-w-full py-2 text-left whitespace-normal text-muted-foreground hover:text-foreground"
                    disabled={!gpu || chat.busy}
                    onClick={() => chat.send(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pt-16 pb-8 lg:pt-8">
                {!gpu && <NoWebGPU />}
                {messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    progress={chat.progress}
                    canRetry={!chat.busy}
                    onRetry={() => chat.retry(m.id)}
                  />
                ))}
              </div>
            </div>
            <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-3">
              <Composer {...composerProps} />
            </div>
          </>
        )}
        <Credit />
      </SidebarInset>
    </SidebarProvider>
  );
}

function NoWebGPU() {
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      Este navegador no soporta WebGPU. Usen una versión reciente de Chrome, Edge o Safari.
    </p>
  );
}

// Close button lives in the sidebar; this one only reopens it. Logo swaps to the panel icon on hover.
function OpenSidebarTrigger() {
  const { state, isMobile, toggleSidebar } = useSidebar();
  if (state === "expanded" && !isMobile) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="group/open absolute top-3 left-3 z-10 bg-chat"
          onClick={toggleSidebar}
          aria-label="Abrir barra lateral"
        >
          <Goliat className="size-7 group-hover/open:hidden group-focus-visible/open:hidden" />
          <PanelLeftOpen className="hidden group-hover/open:block group-focus-visible/open:block" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-lg:hidden">
        Abrir barra lateral <Shortcut>Ctrl+B</Shortcut>
      </TooltipContent>
    </Tooltip>
  );
}

function CloseSidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={toggleSidebar}
          aria-label="Cerrar barra lateral"
        >
          <PanelLeftClose />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-lg:hidden">
        Cerrar barra lateral <Shortcut>Ctrl+B</Shortcut>
      </TooltipContent>
    </Tooltip>
  );
}

function Shortcut({ children }: { children: string }) {
  return <kbd className="ml-1 hidden font-sans opacity-60 lg:inline">{children}</kbd>;
}

type SidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
};

function ChatSidebar({ conversations, activeId, onSelect, onNew, onRemove }: SidebarProps) {
  const { setOpenMobile } = useSidebar();
  const sorted = conversations.toSorted((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Sidebar>
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-2.5 px-2 pt-1">
          <Goliat className="size-8" />
          <div>
            <p className="font-heading text-lg leading-none font-extrabold text-ink">gol-IA-t</p>
            <p className={cn(labelClass, "mt-1 text-[10px]")}>Chat local</p>
          </div>
          <CloseSidebarTrigger />
        </div>
        <Button
          variant="outline"
          className="group/new justify-start"
          onClick={() => {
            onNew();
            setOpenMobile(false);
          }}
        >
          <MessageSquarePlus />
          Nuevo chat
          <kbd className="ml-auto hidden font-sans lg:inline text-xs font-normal text-muted-foreground opacity-0 transition-opacity group-hover/new:opacity-100 group-focus-visible/new:opacity-100">
            Ctrl+Shift+O
          </kbd>
        </Button>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu aria-label="Conversaciones">
            {sorted.map((c) => (
              <SidebarMenuItem key={c.id}>
                <SidebarMenuButton
                  isActive={c.id === activeId}
                  onClick={() => {
                    onSelect(c.id);
                    setOpenMobile(false);
                  }}
                >
                  <span className="truncate">{c.title}</span>
                </SidebarMenuButton>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuAction
                      showOnHover
                      onClick={() => onRemove(c.id)}
                      aria-label={`Eliminar «${c.title}»`}
                    >
                      <Trash2 />
                    </SidebarMenuAction>
                  </TooltipTrigger>
                  <TooltipContent side="right">Eliminar conversación</TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 pb-4 text-xs text-muted-foreground">
        <p>El modelo se ejecuta en su navegador.</p>
        <p>Los chats se guardan en la caché del navegador.</p>
      </SidebarFooter>
    </Sidebar>
  );
}
