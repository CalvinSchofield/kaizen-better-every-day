import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isNativeApp } from '@/utils/platform';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTED_PROMPTS = [
  "How's my week looking vs last week?",
  "What day do I sell best on?",
  "Am I on pace for my goal?",
  "Where am I losing deals in my funnel?",
  "When do I sell the most during the day?",
  "Give me something to bring up in my 1-on-1",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/insights-chat`;

async function parseErrorResponse(resp: Response, onError: (msg: string) => void) {
  try {
    const body = await resp.json();
    if (resp.status === 429) {
      onError(body.error || 'Too many requests. Please wait a moment.');
    } else if (resp.status === 402) {
      onError(body.error || 'AI credits exhausted.');
    } else {
      onError(body.error || 'Something went wrong.');
    }
  } catch {
    onError('Something went wrong.');
  }
}

async function fetchChatResponse(messages: Message[], sessionToken: string, stream: boolean) {
  return fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages, stream }),
  });
}

async function requestNonStreamingChat({
  messages,
  sessionToken,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  sessionToken: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  let resp: Response;

  try {
    resp = await fetchChatResponse(messages, sessionToken, false);
  } catch {
    onError('Network error. Please check your connection.');
    return;
  }

  if (!resp.ok) {
    await parseErrorResponse(resp, onError);
    return;
  }

  try {
    const body = await resp.json();
    const content = typeof body.content === 'string' ? body.content : '';
    if (!content.trim()) {
      onError('Empty response');
      return;
    }
    onDelta(content);
    onDone();
  } catch {
    onError('Something went wrong.');
  }
}

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    onError("Please sign in to use AI Coach.");
    return;
  }

  const sessionToken = session.access_token;

  if (isNativeApp()) {
    await requestNonStreamingChat({
      messages,
      sessionToken,
      onDelta,
      onDone,
      onError,
    });
    return;
  }

  let resp: Response;
  try {
    resp = await fetchChatResponse(messages, sessionToken, true);
  } catch {
    onError("Network error. Please check your connection.");
    return;
  }

  if (!resp.ok) {
    await parseErrorResponse(resp, onError);
    return;
  }

  if (!resp.body) {
    await requestNonStreamingChat({
      messages,
      sessionToken,
      onDelta,
      onDone,
      onError,
    });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamDone = false;

  try {
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') {
          streamDone = true;
          break;
        }
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + '\n' + buffer;
          break;
        }
      }
    }

    if (buffer.trim()) {
      for (let raw of buffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (!raw.startsWith('data: ')) continue;
        const json = raw.slice(6).trim();
        if (json === '[DONE]') continue;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          // ignore trailing partial event
        }
      }
    }

    onDone();
  } catch {
    onError('Connection interrupted. Please try again.');
  }
}

interface InsightsChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InsightsChat = ({ isOpen, onClose }: InsightsChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const assistantContentRef = useRef('');

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);
    assistantContentRef.current = '';

    const upsert = (chunk: string) => {
      assistantContentRef.current += chunk;
      const soFar = assistantContentRef.current;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: soFar } : m);
        }
        return [...prev, { role: 'assistant', content: soFar }];
      });
    };

    await streamChat({
      messages: updatedMessages,
      onDelta: upsert,
      onDone: () => setIsStreaming(false),
      onError: (msg) => {
        toast.error(msg);
        setIsStreaming(false);
      },
    });
  }, [messages, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 bg-background flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        bottom: 'calc(var(--nav-height) + var(--nav-padding-bottom))',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background">
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 -ml-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-lg font-semibold truncate">AI Coach</h1>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Talk to Your Data</h2>
              <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                Ask anything about your performance — I've got all your numbers ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="px-3.5 py-2 text-sm rounded-full border border-border/60 bg-card hover:bg-accent hover:border-primary/30 text-foreground transition-all duration-200 text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-card border border-border/50 rounded-bl-md'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_strong]:text-foreground">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {isStreaming && i === messages.length - 1 && (
                      <span className="inline-block w-1.5 h-4 bg-primary/60 rounded-sm ml-0.5 animate-pulse" />
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing indicator when assistant message hasn't started yet */}
        {isStreaming && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
          <div className="flex justify-start">
            <div className="bg-card border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="border-t border-border/50 bg-background px-4 py-3 pb-3"
      >
        <div className="flex items-end gap-2 max-w-lg mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your numbers..."
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="rounded-full h-11 w-11 shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-40"
          >
            {isStreaming ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <Send className="h-4.5 w-4.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
