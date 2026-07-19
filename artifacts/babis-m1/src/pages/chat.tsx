import { useEffect, useRef, useState } from "react";
import {
  useListChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useListMessages,
  useSendMessage,
  useGetTrainingStatus,
  getListChatSessionsQueryKey,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Plus, Trash2, Menu, X, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Chat() {
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [thinkingMode, setThinkingMode] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const hasAutoCreated = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const { data: sessions = [], isLoading: sessionsLoading } = useListChatSessions({
    query: { refetchInterval: 10_000 },
  } as any);

  const { data: messages = [], isFetching: messagesFetching } = useListMessages(
    activeSessionId!,
    { query: { enabled: !!activeSessionId, refetchInterval: 2_000 } },
  );

  const { data: trainingStatus } = useGetTrainingStatus(undefined, {
    query: { refetchInterval: 5_000 },
  });

  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const sendMessage = useSendMessage();

  // ── Auto-create first session ─────────────────────────────────────────────
  // On first load, create a default chat session so the user can start
  // immediately — no need to manually click "New Chat".

  useEffect(() => {
    if (
      !sessionsLoading &&
      sessions.length === 0 &&
      !hasAutoCreated.current &&
      !createSession.isPending
    ) {
      hasAutoCreated.current = true;
      createSession.mutate(
        { data: { title: "Babis M1 — Chat" } },
        {
          onSuccess: (newSession: any) => {
            setActiveSessionId(newSession.id);
            queryClient.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
          },
          onError: () => {
            hasAutoCreated.current = false; // allow retry on next render
          },
        },
      );
    }
  }, [sessionsLoading, sessions.length]);

  // Auto-select first session if none selected yet
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId((sessions as any[])[0].id);
    }
  }, [sessions, activeSessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreateSession = () => {
    createSession.mutate(
      { data: { title: `Chat ${(sessions as any[]).length + 1}` } },
      {
        onSuccess: (newSession: any) => {
          setActiveSessionId(newSession.id);
          queryClient.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
          setMobileSidebarOpen(false);
        },
      },
    );
  };

  const handleDeleteSession = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteSession.mutate(
      { sessionId: id },
      {
        onSuccess: () => {
          if (activeSessionId === id) setActiveSessionId(null);
          queryClient.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
        },
      },
    );
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !activeSessionId || sendMessage.isPending) return;

    sendMessage.mutate(
      { sessionId: activeSessionId, data: { content: trimmed, thinkingMode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(activeSessionId) });
        },
      },
    );
    setInput("");
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-grow textarea
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const isTraining = trainingStatus?.status === "running";
  const msgList = Array.isArray(messages) ? messages : (messages as any)?.items ?? [];
  const sessionList = Array.isArray(sessions) ? sessions : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full relative overflow-hidden">
      {/* ── Mobile sidebar overlay ────────────────────────────────────────── */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sessions sidebar ──────────────────────────────────────────────── */}
      <div
        className={cn(
          "absolute md:static inset-y-0 left-0 z-40 w-72 border-r border-border bg-background transform transition-transform duration-300 ease-in-out flex flex-col",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Sidebar header */}
        <div className="h-14 px-4 border-b border-border flex items-center justify-between shrink-0">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Conversations
          </span>
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {sessionsLoading ? (
            <div className="flex flex-col gap-1 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : sessionList.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono text-xs">
              Starting first session…
            </div>
          ) : (
            sessionList.map((session: any) => (
              <div
                key={session.id}
                onClick={() => {
                  setActiveSessionId(session.id);
                  setMobileSidebarOpen(false);
                }}
                className={cn(
                  "group flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors font-mono text-sm",
                  activeSessionId === session.id
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <span className="truncate text-xs">
                    {session.title || `Chat ${session.id}`}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 ml-2 text-muted-foreground hover:text-destructive transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* New chat button */}
        <div className="p-3 border-t border-border shrink-0">
          <button
            onClick={handleCreateSession}
            disabled={createSession.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-md p-2.5 font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>
      </div>

      {/* ── Main chat area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-background">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-background z-10">
          {/* Mobile burger */}
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2 font-mono font-bold tracking-widest text-primary">
            BABIS M1
            <span className="text-muted-foreground font-normal text-[10px] bg-muted px-1.5 py-0.5 rounded">
              v1.0
            </span>
          </div>

          {/* Training pulse — shown on all sizes */}
          <div className="ml-auto flex items-center gap-2">
            {isTraining ? (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-secondary bg-secondary/10 border border-secondary/20 px-2.5 py-1 rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-secondary" />
                </span>
                <span className="hidden sm:inline">TRAINING ACTIVE</span>
                <span className="sm:hidden">LIVE</span>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                STATIC
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-5 scroll-smooth">
          {msgList.length === 0 && !sendMessage.isPending ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-20">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                  <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
                  <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
                </svg>
              </div>
              <div>
                <p className="font-mono text-sm text-foreground font-semibold">Babis M1 is ready</p>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  {isTraining ? "Training in progress — responses improve over time" : "Ask anything to get started"}
                </p>
              </div>
              {/* Quick start prompts */}
              <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-sm">
                {["Explain attention mechanism", "Write a binary search", "Solve: ∫x·eˣ dx", "What is BPE tokenization?"].map((p) => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); textareaRef.current?.focus(); }}
                    className="text-[11px] font-mono text-muted-foreground border border-border hover:border-primary/40 hover:text-primary px-3 py-1.5 rounded-full transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            msgList.map((msg: any) => (
              <div
                key={msg.id}
                className={cn(
                  "max-w-3xl w-full flex flex-col gap-1",
                  msg.role === "user" ? "self-end items-end" : "self-start items-start",
                )}
              >
                {/* Assistant label */}
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-primary mb-1 uppercase tracking-wider">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
                    </svg>
                    Babis M1
                  </div>
                )}

                <div
                  className={cn(
                    "px-4 py-3 rounded-xl w-full max-w-none break-words",
                    "prose prose-invert prose-p:leading-relaxed prose-p:my-1",
                    "prose-pre:bg-[#0a0d12] prose-pre:border prose-pre:border-border prose-pre:rounded-lg",
                    "prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
                    "prose-headings:font-mono prose-headings:text-foreground",
                    msg.role === "user"
                      ? "bg-muted/80 text-foreground text-sm"
                      : "bg-transparent border border-border/60 text-foreground/90 text-sm",
                  )}
                >
                  {msg.thinkingMode && msg.role === "assistant" && (
                    <div className="mb-3 text-[10px] font-mono text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
                      <div className="w-1 h-3 bg-primary/50 animate-pulse rounded" />
                      Reasoning trace active
                    </div>
                  )}
                  <ReactMarkdown
                    components={{
                      code(props) {
                        const { children, className, node: _node, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || "");
                        return match ? (
                          <SyntaxHighlighter
                            {...(rest as any)}
                            PreTag="div"
                            language={match[1]}
                            style={vscDarkPlus as any}
                            customStyle={{ background: "transparent", margin: 0, padding: "0.75rem" }}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono text-xs">
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          )}

          {/* Thinking indicator */}
          {sendMessage.isPending && (
            <div className="self-start max-w-3xl w-full flex flex-col gap-1">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-primary mb-1 uppercase tracking-wider">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                  <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
                </svg>
                Babis M1
              </div>
              <div className="px-4 py-4 border border-border/60 rounded-xl bg-transparent flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="p-3 sm:p-4 bg-background border-t border-border shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Thinking mode + model status row */}
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="thinking-mode"
                  checked={thinkingMode}
                  onCheckedChange={setThinkingMode}
                  className="data-[state=checked]:bg-primary scale-90"
                />
                <Label htmlFor="thinking-mode" className="font-mono text-[10px] text-muted-foreground cursor-pointer uppercase tracking-wider">
                  Reasoning
                </Label>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                Step {trainingStatus?.step?.toLocaleString() ?? "—"} · Loss {trainingStatus?.loss?.toFixed(3) ?? "—"}
              </div>
            </div>

            {/* Text input + send */}
            <form onSubmit={handleSend} className="relative">
              <textarea
                ref={textareaRef}
                rows={1}
                className="w-full bg-muted/40 border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/30 rounded-xl p-3.5 pr-14 resize-none font-mono text-sm placeholder:text-muted-foreground outline-none transition-all"
                style={{ minHeight: "52px", maxHeight: "200px" }}
                placeholder="Message Babis M1…"
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || sendMessage.isPending || !activeSessionId}
                className="absolute right-3 bottom-3 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-center font-mono text-[9px] text-muted-foreground/40 mt-2">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
