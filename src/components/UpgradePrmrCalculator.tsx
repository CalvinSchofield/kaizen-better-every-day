import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Send, Loader2, Calculator, Check } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UpgradePrmrCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrmrCalculated?: (prmr: number) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-upgrade-prmr`;

export const UpgradePrmrCalculator = ({
  open,
  onOpenChange,
  onPrmrCalculated,
}: UpgradePrmrCalculatorProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "What equipment did you sell? (List each item and I'll add up the total)"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [detectedPrmr, setDetectedPrmr] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setDetectedPrmr(null);

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: [...messages.slice(1), userMessage].map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();
      
      // Handle the new response format
      if (data.type === "calculation") {
        // Deterministic calculation result
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.content 
        }]);
        if (data.prmr) {
          setDetectedPrmr(data.prmr);
        }
      } else if (data.type === "message") {
        // AI is asking a clarifying question
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.content 
        }]);
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: error instanceof Error ? error.message : "Sorry, I had trouble processing that. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleUsePrmr = () => {
    if (detectedPrmr && onPrmrCalculated) {
      onPrmrCalculated(detectedPrmr);
      onOpenChange(false);
    }
  };

  const resetChat = () => {
    setMessages([{
      role: "assistant",
      content: "What equipment did you sell? (List each item and I'll add up the total)"
    }]);
    setInput("");
    setDetectedPrmr(null);
  };

  // Format message content with line breaks for the breakdown
  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line.replace(/\*\*/g, '')}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetChat();
    }}>
      <DrawerContent className="h-[70dvh] max-h-[70dvh]">
        <div className="flex flex-col h-full overflow-hidden">
          <DrawerHeader className="pb-2 flex-shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Upgrade PRMR Calculator
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col flex-1 px-4 pb-4 overflow-hidden">
            {/* Messages area - scrollable */}
            <div 
              className="flex-1 overflow-y-auto min-h-0"
              style={{ overscrollBehavior: 'contain' }}
            >
              <div className="space-y-3 py-2">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{formatContent(msg.content)}</p>
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Use PRMR button */}
            {detectedPrmr && !isLoading && (
              <div className="py-3 border-t border-border flex-shrink-0">
                <Button
                  onClick={handleUsePrmr}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Use ${detectedPrmr.toFixed(2)} PRMR
                </Button>
              </div>
            )}

            {/* Input area - always visible at bottom */}
            <div 
              className={`flex gap-2 pt-3 flex-shrink-0 ${detectedPrmr && !isLoading ? '' : 'border-t border-border'}`}
              onClick={() => inputRef.current?.focus()}
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="List your equipment..."
                disabled={isLoading}
                className="flex-1"
                autoComplete="off"
              />
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  sendMessage();
                }}
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
