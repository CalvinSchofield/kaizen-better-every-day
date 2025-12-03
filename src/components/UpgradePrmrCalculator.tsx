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

// Extract PRMR value from AI response
const extractPrmrValue = (text: string): number | null => {
  const patterns = [
    /\$?([\d,]+(?:\.\d{1,2})?)\s*(?:PRMR|prmr)/i,
    /(?:PRMR|prmr)(?:\s*(?:is|:|=))?\s*\$?([\d,]+(?:\.\d{1,2})?)/i,
    /(?:total|final)\s*(?:PRMR|prmr)(?:\s*(?:is|:|=))?\s*\$?([\d,]+(?:\.\d{1,2})?)/i,
    /(?:your|the)\s*(?:PRMR|prmr)(?:\s*(?:is|would be|comes to|equals))?\s*\$?([\d,]+(?:\.\d{1,2})?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value) && value > 0 && value < 1000) {
        return value;
      }
    }
  }
  return null;
};

// Clean up any stray markdown from AI response
const cleanContent = (text: string): string => {
  return text
    .replace(/\*\*/g, '') // Remove bold markers
    .replace(/\*/g, '')   // Remove italic markers
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/`/g, '')    // Remove code markers
    .trim();
};

export const UpgradePrmrCalculator = ({
  open,
  onOpenChange,
  onPrmrCalculated,
}: UpgradePrmrCalculatorProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'll help you calculate your PRMR for this upgrade. What equipment did you sell? (List each item and I'll add up the total)"
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

  // Check for PRMR values in assistant messages
  useEffect(() => {
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
    if (lastAssistantMessage) {
      const prmr = extractPrmrValue(lastAssistantMessage.content);
      setDetectedPrmr(prmr);
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setDetectedPrmr(null);

    let assistantContent = "";

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

      if (!response.ok || !response.body) {
        throw new Error("Failed to get response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              const cleanedContent = cleanContent(assistantContent);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: cleanedContent } : m);
                }
                return [...prev, { role: "assistant", content: cleanedContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I had trouble processing that. Please try again." 
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
      content: "Hi! I'll help you calculate your PRMR for this upgrade. What equipment did you sell? (List each item and I'll add up the total)"
    }]);
    setInput("");
    setDetectedPrmr(null);
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetChat();
    }}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2 flex-shrink-0">
          <DrawerTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Upgrade PRMR Calculator
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col px-4 pb-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {/* Messages area - scrollable */}
          <div 
            className="flex-1 overflow-y-auto min-h-[200px] max-h-[50vh] mb-3"
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
                    <p className="whitespace-pre-wrap">{msg.content}</p>
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

          {/* Input area - fixed at bottom */}
          <div className={`flex gap-2 pt-3 flex-shrink-0 ${detectedPrmr && !isLoading ? '' : 'border-t border-border'}`}>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="List your equipment..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
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
      </DrawerContent>
    </Drawer>
  );
};
