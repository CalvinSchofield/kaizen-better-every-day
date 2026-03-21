import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Send, Loader2, Calculator, Check, MessageSquare, Wrench } from "lucide-react";
import { UpgradeEquipmentConfigurator } from "@/components/tools/package-builder/upgrade/UpgradeEquipmentConfigurator";
import {
  UPGRADE_EQUIPMENT_LIST,
  UPGRADE_CONFIG,
} from "@/components/tools/package-builder/upgrade/upgradeTypes";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatPRMR } from "@/lib/formatters";

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
  // Builder state
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [newCameraCounts, setNewCameraCounts] = useState<Record<string, number>>({});
  const [includePanel, setIncludePanel] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "What equipment did you sell? (List each item and I'll calculate the PRMR)" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatDetectedPrmr, setChatDetectedPrmr] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Builder quantity handlers
  const handleQuantityChange = (itemId: string, delta: number) => {
    setQuantities(prev => {
      const newQty = Math.max(0, (prev[itemId] || 0) + delta);
      const item = UPGRADE_EQUIPMENT_LIST.find(i => i.id === itemId);
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        // Also clear new camera count
        setNewCameraCounts(p => {
          const { [itemId]: __, ...r } = p;
          return r;
        });
        return rest;
      }
      // For alwaysNewCamera items, auto-set new camera count
      if (item?.alwaysNewCamera) {
        setNewCameraCounts(p => ({ ...p, [itemId]: newQty }));
      }
      // Cap new camera count if quantity decreased
      if (item?.incursVideoFee && !item.alwaysNewCamera) {
        setNewCameraCounts(p => {
          const current = p[itemId] || 0;
          if (current > newQty) return { ...p, [itemId]: newQty };
          return p;
        });
      }
      return { ...prev, [itemId]: newQty };
    });
  };

  const handleNewCameraCountChange = (itemId: string, delta: number) => {
    setNewCameraCounts(prev => {
      const maxQty = quantities[itemId] || 0;
      const newCount = Math.max(0, Math.min(maxQty, (prev[itemId] || 0) + delta));
      if (newCount === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newCount };
    });
  };

  // Real-time PRMR calculation
  const upgradePrices = useMemo(() => {
    let equipmentTotal = 0;
    let totalNewCameras = 0;

    UPGRADE_EQUIPMENT_LIST.forEach(item => {
      const qty = quantities[item.id] || 0;
      if (qty > 0) {
        equipmentTotal += item.price * qty;
        if (item.incursVideoFee || item.alwaysNewCamera) {
          totalNewCameras += newCameraCounts[item.id] || 0;
        }
      }
    });

    if (includePanel) {
      equipmentTotal += UPGRADE_CONFIG.panelPrice;
    }

    const monthlyEquipment = equipmentTotal / 60;
    const monthlyVideo = totalNewCameras * UPGRADE_CONFIG.videoFeePerCamera;
    const prmr = monthlyEquipment + monthlyVideo;

    return {
      equipmentTotal,
      totalNewCameras,
      monthlyEquipment,
      monthlyVideo,
      prmr,
    };
  }, [quantities, newCameraCounts, includePanel]);

  const totalItems = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  const hasBuildSelection = totalItems > 0 || includePanel;

  // Chat logic
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setChatDetectedPrmr(null);

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
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
        if (data.prmr) setChatDetectedPrmr(data.prmr);
      } else if (data.type === "message") {
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
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

  const handleUsePrmr = (prmr: number) => {
    if (onPrmrCalculated) {
      onPrmrCalculated(prmr);
      onOpenChange(false);
    }
  };

  const resetAll = () => {
    setQuantities({});
    setNewCameraCounts({});
    setIncludePanel(false);
    setMessages([
      { role: "assistant", content: "What equipment did you sell? (List each item and I'll calculate the PRMR)" }
    ]);
    setInput("");
    setChatDetectedPrmr(null);
    setIsLoading(false);
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
      if (!isOpen) resetAll();
    }}>
      <DrawerContent data-tour="track-upgrade-calculator" className="h-[85dvh] max-h-[85dvh]">
        <div className="flex flex-col h-full overflow-hidden">
          <DrawerHeader className="pb-2 flex-shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Upgrade PRMR Calculator
            </DrawerTitle>
          </DrawerHeader>

          <Tabs defaultValue="builder" className="flex flex-col flex-1 overflow-hidden px-4">
            <TabsList className="w-full flex-shrink-0 mb-3">
              <TabsTrigger value="builder" className="flex-1 gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                Builder
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex-1 gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </TabsTrigger>
            </TabsList>

            {/* ========== BUILDER TAB ========== */}
            <TabsContent value="builder" className="flex-1 overflow-hidden flex flex-col mt-0">
              <div className="flex-1 overflow-y-auto min-h-0 pb-4" style={{ overscrollBehavior: 'contain' }}>
                {/* Panel toggle */}
                <div className="flex items-center justify-between rounded-xl bg-muted/50 border border-border p-3 mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src="/images/products/panel.jpeg"
                      alt="Panel"
                      className="w-10 h-10 rounded-lg object-cover bg-muted"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div>
                      <Label className="text-sm font-medium">Panel Upgrade</Label>
                      <p className="text-[10px] text-muted-foreground">${UPGRADE_CONFIG.panelPrice}</p>
                    </div>
                  </div>
                  <Switch checked={includePanel} onCheckedChange={setIncludePanel} />
                </div>

                {/* Equipment cards */}
                <UpgradeEquipmentConfigurator
                  quantities={quantities}
                  newCameraCounts={newCameraCounts}
                  onQuantityChange={handleQuantityChange}
                  onNewCameraCountChange={handleNewCameraCountChange}
                />
              </div>

              {/* Sticky bottom summary */}
              {hasBuildSelection && (
                <div className="flex-shrink-0 border-t border-border pt-3 pb-4 space-y-2">
                  {/* Breakdown */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>Equipment: ${upgradePrices.equipmentTotal.toFixed(0)} ÷ 60</span>
                    <span>${upgradePrices.monthlyEquipment.toFixed(2)}/mo</span>
                  </div>
                  {upgradePrices.totalNewCameras > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span>{upgradePrices.totalNewCameras} new cam{upgradePrices.totalNewCameras !== 1 ? 's' : ''} × $5</span>
                      <span>+${upgradePrices.monthlyVideo.toFixed(2)}/mo</span>
                    </div>
                  )}

                  {/* PRMR display */}
                  <div className="flex items-center justify-between bg-primary/10 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Upgrade PRMR</p>
                      <p className="text-2xl font-bold text-primary">${formatPRMR(upgradePrices.prmr)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Upfront (×4)</p>
                      <p className="text-sm font-semibold">${formatPRMR(upgradePrices.prmr * 4)}</p>
                    </div>
                  </div>

                  {/* Use PRMR button */}
                  {onPrmrCalculated && upgradePrices.prmr > 0 && (
                    <Button
                      onClick={() => handleUsePrmr(upgradePrices.prmr)}
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Use ${formatPRMR(upgradePrices.prmr)} PRMR
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ========== CHAT TAB ========== */}
            <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col mt-0">
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

              {/* Use PRMR from chat */}
              {chatDetectedPrmr && !isLoading && onPrmrCalculated && (
                <div className="py-3 border-t border-border flex-shrink-0">
                  <Button
                    onClick={() => handleUsePrmr(chatDetectedPrmr)}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Use ${chatDetectedPrmr.toFixed(2)} PRMR
                  </Button>
                </div>
              )}

              {/* Chat input */}
              <div className="flex gap-2 pt-3 pb-4 flex-shrink-0 border-t border-border">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type equipment list..."
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
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
