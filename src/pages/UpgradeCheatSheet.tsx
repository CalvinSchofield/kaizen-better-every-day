import { useState } from "react";
import { ArrowLeft, Calculator, Clock, Target, DollarSign, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { UpgradePrmrCalculator } from "@/components/UpgradePrmrCalculator";

interface PainPoint {
  emoji: string;
  text: string;
}

interface Product {
  id: string;
  name: string;
  category: "doorbell" | "outdoor" | "indoor" | "panel";
  image: string;
  painPoints: PainPoint[];
  isOpportunity?: boolean;
}

const PRODUCTS: Product[] = [
  {
    id: "doorbell-old",
    name: "Doorbell Camera",
    category: "doorbell",
    image: "/images/cameras/doorbell-camera.jpeg",
    painPoints: [
      { emoji: "👎", text: "Not clear. Bad quality and can't see anything at night" },
      { emoji: "⏱️", text: "Miss things. Only records 30 second clips" },
      { emoji: "📶", text: "Has to have the WiFi. Falls offline all the time" },
      { emoji: "🔘", text: "Button falls off a lot. Mechanical doorbell button breaks often" },
    ],
  },
  {
    id: "doorbell-pro",
    name: "Doorbell Camera Pro",
    category: "doorbell",
    image: "/images/cameras/doorbell-camera-pro.jpeg",
    painPoints: [
      { emoji: "📶", text: "Has to have the WiFi. Falls offline all the time" },
      { emoji: "💾", text: "24/7 is unreliable. Can only do it with WiFi working and if they have the \"space monkey\" DVR" },
      { emoji: "🧠", text: "Not as smart. Older processor — doesn't notify all the time or maybe too much when it doesn't matter" },
      { emoji: "🔊", text: "Not great audio. Speaker and microphone aren't as good as the new one" },
    ],
  },
  {
    id: "outdoor-old",
    name: "Outdoor Camera",
    category: "outdoor",
    image: "/images/cameras/outdoor-camera.jpeg",
    painPoints: [
      { emoji: "🔇", text: "No sound. Literally just video — no sound or talking through cameras" },
      { emoji: "👎", text: "Not clear. Bad quality and can't see anything at night" },
      { emoji: "⏱️", text: "Miss things. Only records 30 second clips" },
      { emoji: "📶", text: "Has to have the WiFi. Falls offline all the time" },
    ],
  },
  {
    id: "outdoor-pro",
    name: "Outdoor Camera Pro",
    category: "outdoor",
    image: "/images/cameras/outdoor-camera-pro.jpeg",
    painPoints: [
      { emoji: "📶", text: "Has to have the WiFi. Falls offline all the time" },
      { emoji: "💾", text: "24/7 is unreliable. Can only do it with WiFi working and if they have the \"space monkey\" DVR" },
      { emoji: "🧠", text: "Not as smart. Older processor — doesn't notify all the time or maybe too much when it doesn't matter" },
      { emoji: "🔊", text: "Not great audio. Speaker and microphone aren't as good as the new one" },
    ],
  },
  {
    id: "outdoor-pro-gen2",
    name: "Outdoor Camera Pro Gen II",
    category: "outdoor",
    image: "/images/cameras/outdoor-camera-pro-gen2.jpeg",
    painPoints: [
      { emoji: "➕", text: "Don't have enough of them" },
      { emoji: "💡", text: "Attach spotlight if they don't have it. Makes it seem like it's a whole new camera" },
      { emoji: "🎥", text: "24/7 recording. Easy upgrade if they don't have it already" },
    ],
    isOpportunity: true,
  },
  {
    id: "indoor-old",
    name: "Old Indoor Camera",
    category: "indoor",
    image: "/images/cameras/indoor-camera-old.png",
    painPoints: [
      { emoji: "🗑️", text: "So old. It's garbage" },
      { emoji: "👎", text: "Not clear. Bad quality and can't see anything at night" },
      { emoji: "📶", text: "Has to have the WiFi. Falls offline all the time" },
      { emoji: "💾", text: "24/7 is unreliable. Can only do it with WiFi working and if they have the \"space monkey\" DVR" },
    ],
  },
  {
    id: "ping-camera",
    name: "Ping Indoor Camera",
    category: "indoor",
    image: "/images/cameras/ping-camera.jpeg",
    painPoints: [
      { emoji: "👎", text: "Not clear. Bad quality and can't see anything at night" },
      { emoji: "📶", text: "Has to have the WiFi. Falls offline all the time" },
      { emoji: "💾", text: "24/7 is unreliable. Can only do it with WiFi working and if they have the \"space monkey\" DVR" },
    ],
  },
  {
    id: "panel-old",
    name: "Old Panel",
    category: "panel",
    image: "/images/cameras/panel-old.jpeg",
    painPoints: [
      { emoji: "📱", text: "Tiny touch screen" },
      { emoji: "🚫", text: "No cameras. Can't work with any new equipment. Way out of date and probably the root of any problems" },
    ],
  },
  {
    id: "panel-less-old",
    name: "Less Old Panel",
    category: "panel",
    image: "/images/cameras/panel-less-old.jpeg",
    painPoints: [
      { emoji: "⚠️", text: "Old processor. Less safe" },
      { emoji: "📷", text: "No new cameras. Can't add any Gen II or newer cameras with this panel" },
      { emoji: "🔘", text: "Physical buttons. Clunky and less classy" },
    ],
  },
];

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "doorbell", label: "Doorbell" },
  { id: "outdoor", label: "Outdoor" },
  { id: "indoor", label: "Indoor" },
  { id: "panel", label: "Panel" },
];

const TIME_TIPS = [
  { time: "1:00–5:30", tip: "Look for upgrades + FP" },
  { time: "5:30–8:00", tip: "Hunt FP primarily" },
  { time: "8:00–dark", tip: "Both upgrades + FP" },
];

const WHY_UPGRADES = [
  { emoji: "🚀", text: "Momentum builder" },
  { emoji: "🗺️", text: "Learn the area" },
  { emoji: "📖", text: "Gather stories" },
  { emoji: "💬", text: "Talk to neighbors" },
  { emoji: "📈", text: "Climb payscale" },
  { emoji: "🥯🚫", text: "No bagels" },
];

const PRMR_STEPS = [
  "Add total equipment (no install/tax)",
  "Divide total by 60",
  "Add $5 per NEW camera",
  "= Your upgrade PRMR",
  "× 4 = Upfront pay",
  "× Rate = Total pay",
];

export default function UpgradeCheatSheet() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const filteredProducts = activeCategory === "all" 
    ? PRODUCTS 
    : PRODUCTS.filter(p => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky Header */}
      <div 
        className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50"
        style={{ paddingTop: 'var(--effective-safe-area-top)' }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/tools")}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Upgrade Cheat Sheet</h1>
              <p className="text-xs text-muted-foreground">Know the pain points. Close more upgrades.</p>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Cards */}
      <div className="px-4 py-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div
                onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                className="rounded-2xl border border-border bg-card overflow-hidden transition-all cursor-pointer"
              >
                {/* Card Header */}
                <div className="flex items-center gap-4 p-4">
                  <div className="shrink-0">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-20 h-20 object-contain rounded-xl bg-muted/50"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {product.painPoints.length} pain points
                    </p>
                  </div>
                  <ChevronRight 
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      expandedProduct === product.id ? "rotate-90" : ""
                    }`}
                  />
                </div>

                {/* Expanded Pain Points */}
                <AnimatePresence>
                  {expandedProduct === product.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-border/50">
                        <div className="space-y-2">
                          {product.painPoints.map((point, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-2.5 rounded-xl bg-destructive/5"
                            >
                              <span className="text-lg">{point.emoji}</span>
                              <span className="text-sm">{point.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Info Sections */}
      <div className="px-4 space-y-4 mt-4">
        {/* When to Hunt */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">When to Hunt Upgrades</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TIME_TIPS.map((item, idx) => (
              <div key={idx} className="bg-muted/50 rounded-xl p-3 text-center">
                <div className="font-semibold text-xs text-primary">{item.time}</div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{item.tip}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Why Upgrades */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Why Do Upgrades</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {WHY_UPGRADES.map((item, idx) => (
              <div key={idx} className="bg-muted/50 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                <span>{item.emoji}</span>
                <span className="text-xs">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calculate Pay */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Calculate Your Pay</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRMR_STEPS.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                  {idx + 1}
                </div>
                <span className="text-xs">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button
          onClick={() => setCalculatorOpen(true)}
          className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg"
        >
          <Calculator className="h-5 w-5 mr-2" />
          Calculate Upgrade PRMR
        </Button>
      </div>

      {/* Calculator Drawer */}
      <UpgradePrmrCalculator
        open={calculatorOpen}
        onOpenChange={setCalculatorOpen}
      />
    </div>
  );
}
