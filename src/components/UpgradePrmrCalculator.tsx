import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Send, Loader2, Calculator, Check, Plus, Minus, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Equipment categories for quick select
const EQUIPMENT_CATEGORIES = [
  {
    name: "Cameras",
    items: [
      { id: "outdoor-pro", label: "Outdoor Pro", price: 399.99, isCamera: true },
      { id: "doorbell-pro", label: "Doorbell Pro", price: 249.99, isCamera: true },
      { id: "indoor-pro", label: "Indoor Pro", price: 249.99, isCamera: true },
      { id: "spotlight", label: "Spotlight", price: 249.99, isCamera: false },
    ]
  },
  {
    name: "Equipment",
    items: [
      { id: "dvr", label: "DVR", price: 299.99, isCamera: false },
      { id: "panel", label: "Panel", price: 499.99, isCamera: false },
      { id: "chime", label: "Chime", price: 59.99, isCamera: false },
      { id: "thermostat", label: "Thermostat", price: 199.99, isCamera: false },
    ]
  },
  {
    name: "Locks & More",
    items: [
      { id: "lock", label: "Smart Lock", price: 179.99, isCamera: false },
      { id: "garage", label: "Garage", price: 50, isCamera: false },
      { id: "sensor-50", label: "Sensor ($50)", price: 50, isCamera: false },
      { id: "sensor-100", label: "Sensor ($100)", price: 100, isCamera: false },
    ]
  }
];

export const UpgradePrmrCalculator = ({
  open,
  onOpenChange,
  onPrmrCalculated,
}: UpgradePrmrCalculatorProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "What equipment did you sell? (List each item or use quick-select below)"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [detectedPrmr, setDetectedPrmr] = useState<number | null>(null);
  const [quickSelectOpen, setQuickSelectOpen] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const totalItems = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);

  const updateQuantity = (id: string, delta: number) => {
    setQuantities(prev => {
      const newQty = Math.max(0, (prev[id] || 0) + delta);
      if (newQty === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: newQty };
    });
  };

  const calculateFromQuickSelect = async () => {
    if (totalItems === 0 || isLoading) return;

    // Build equipment list from quantities
    const equipmentList: string[] = [];
    EQUIPMENT_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        const qty = quantities[item.id] || 0;
        if (qty > 0) {
          equipmentList.push(`${qty} ${item.label}`);
        }
      });
    });

    const userMessage = equipmentList.join(", ");
    await sendMessageToAPI(userMessage);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    await sendMessageToAPI(input.trim());
    setInput("");
  };

  const sendMessageToAPI = async (messageContent: string) => {
    const userMessage: Message = { role: "user", content: messageContent };
    setMessages(prev => [...prev, userMessage]);
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
      
      if (data.type === "calculation") {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.content 
        }]);
        if (data.prmr) {
          setDetectedPrmr(data.prmr);
          setQuickSelectOpen(false);
        }
      } else if (data.type === "message") {
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
      content: "What equipment did you sell? (List each item or use quick-select below)"
    }]);
    setInput("");
    setDetectedPrmr(null);
    setQuantities({});
    setQuickSelectOpen(true);
  };

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
      <DrawerContent data-tour="track-upgrade-calculator" className="h-[85dvh] max-h-[85dvh]">
        <div className="flex flex-col h-full overflow-hidden">
          <DrawerHeader className="pb-2 flex-shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Upgrade PRMR Calculator
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col flex-1 px-4 pb-4 overflow-hidden">
            {/* Quick Select Section */}
            <div className="flex-shrink-0 border-b border-border pb-3 mb-3">
              <button
                onClick={() => setQuickSelectOpen(!quickSelectOpen)}
                className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground mb-2"
              >
                <span className="flex items-center gap-2">
                  Quick Select
                  {totalItems > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {totalItems} items
                    </span>
                  )}
                </span>
                {quickSelectOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {quickSelectOpen && (
                <div className="space-y-3">
                  {EQUIPMENT_CATEGORIES.map(category => (
                    <div key={category.name}>
                      <p className="text-xs text-muted-foreground mb-1.5">{category.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {category.items.map(item => {
                          const qty = quantities[item.id] || 0;
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center gap-1 rounded-full border transition-all",
                                qty > 0
                                  ? "bg-primary/10 border-primary"
                                  : "bg-muted/50 border-border"
                              )}
                            >
                              {qty > 0 && (
                                <button
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="p-1.5 hover:bg-primary/20 rounded-full"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="px-2 py-1 text-xs font-medium flex items-center gap-1"
                              >
                                {item.label}
                                {qty > 0 && (
                                  <span className="bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                                    {qty}
                                  </span>
                                )}
                              </button>
                              {qty === 0 && (
                                <Plus className="w-3 h-3 mr-2 text-muted-foreground" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {totalItems > 0 && (
                    <Button
                      onClick={calculateFromQuickSelect}
                      disabled={isLoading}
                      className="w-full h-10 mt-2"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Calculator className="w-4 h-4 mr-2" />
                      )}
                      Calculate PRMR
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Messages area */}
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

            {/* Chat input */}
            <div 
              className={`flex gap-2 pt-3 flex-shrink-0 ${detectedPrmr && !isLoading ? '' : 'border-t border-border'}`}
              onClick={() => inputRef.current?.focus()}
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Or type equipment list..."
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
