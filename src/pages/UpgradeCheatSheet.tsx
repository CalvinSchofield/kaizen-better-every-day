import { useState } from "react";
import { ArrowLeft, ChevronRight, Calculator, Clock, Target, DollarSign, Camera, Monitor, Home, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { UpgradePrmrCalculator } from "@/components/UpgradePrmrCalculator";

interface PainPoint {
  text: string;
  emoji?: string;
}

interface Product {
  id: string;
  name: string;
  category: "doorbell" | "outdoor" | "indoor" | "panel";
  isUpgradeOpportunity?: boolean;
  imageUrl?: string;
  painPoints: PainPoint[];
}

const PRODUCTS: Product[] = [
  // Doorbell Cameras
  {
    id: "doorbell-old",
    name: "Doorbell Camera",
    category: "doorbell",
    imageUrl: "/images/cameras/doorbell-camera.jpeg",
    painPoints: [
      { text: "Not clear. Bad quality and can't see anything at night", emoji: "👎" },
      { text: "Miss things. Only records 30 second clips", emoji: "⏱️" },
      { text: "Has to have the WiFi. Falls offline all the time", emoji: "📶" },
      { text: "Button falls off a lot. Mechanical doorbell button breaks often", emoji: "🔘" },
    ],
  },
  {
    id: "doorbell-pro",
    name: "Doorbell Camera Pro",
    category: "doorbell",
    imageUrl: "/images/cameras/doorbell-camera-pro.jpeg",
    painPoints: [
      { text: "Has to have the WiFi. Falls offline all the time", emoji: "📶" },
      { text: "24/7 is unreliable. Can only do it with WiFi working and if they have the \"space monkey\" DVR", emoji: "💾" },
      { text: "Not as smart. Older processor — doesn't notify all the time or maybe too much when it doesn't matter", emoji: "🧠" },
      { text: "Not great audio. Speaker and microphone aren't as good as the new one", emoji: "🔊" },
    ],
  },
  // Outdoor Cameras
  {
    id: "outdoor-old",
    name: "Outdoor Camera",
    category: "outdoor",
    imageUrl: "/images/cameras/outdoor-camera.jpeg",
    painPoints: [
      { text: "No sound. Literally just video — no sound or talking through cameras", emoji: "🔇" },
      { text: "Not clear. Bad quality and can't see anything at night", emoji: "👎" },
      { text: "Miss things. Only records 30 second clips", emoji: "⏱️" },
      { text: "Has to have the WiFi. Falls offline all the time", emoji: "📶" },
    ],
  },
  {
    id: "outdoor-pro",
    name: "Outdoor Camera Pro",
    category: "outdoor",
    imageUrl: "/images/cameras/outdoor-camera-pro.jpeg",
    painPoints: [
      { text: "Has to have the WiFi. Falls offline all the time", emoji: "📶" },
      { text: "24/7 is unreliable. Can only do it with WiFi working and if they have the \"space monkey\" DVR", emoji: "💾" },
      { text: "Not as smart. Older processor — doesn't notify all the time or maybe too much when it doesn't matter", emoji: "🧠" },
      { text: "Not great audio. Speaker and microphone aren't as good as the new one", emoji: "🔊" },
    ],
  },
  {
    id: "outdoor-pro-gen2",
    name: "Outdoor Camera Pro Gen II",
    category: "outdoor",
    isUpgradeOpportunity: true,
    painPoints: [
      { text: "Don't have enough of them", emoji: "➕" },
      { text: "Attach spotlight if they don't have it. Makes it seem like it's a whole new camera", emoji: "💡" },
      { text: "24/7 recording. Easy upgrade if they don't have it already", emoji: "🎥" },
    ],
  },
  // Indoor Cameras
  {
    id: "indoor-old",
    name: "Old Indoor Camera",
    category: "indoor",
    painPoints: [
      { text: "So old. It's garbage", emoji: "🗑️" },
      { text: "Not clear. Bad quality and can't see anything at night", emoji: "👎" },
      { text: "Has to have the WiFi. Falls offline all the time", emoji: "📶" },
      { text: "24/7 is unreliable. Can only do it with WiFi working and if they have the \"space monkey\" DVR", emoji: "💾" },
    ],
  },
  {
    id: "ping-camera",
    name: "Ping Indoor Camera",
    category: "indoor",
    painPoints: [
      { text: "Not clear. Bad quality and can't see anything at night", emoji: "👎" },
      { text: "Has to have the WiFi. Falls offline all the time", emoji: "📶" },
      { text: "24/7 is unreliable. Can only do it with WiFi working and if they have the \"space monkey\" DVR", emoji: "💾" },
    ],
  },
  // Panels
  {
    id: "panel-old",
    name: "Old Panel",
    category: "panel",
    painPoints: [
      { text: "Tiny touch screen", emoji: "📱" },
      { text: "No cameras. Can't work with any new equipment. Way out of date and probably the root of any problems", emoji: "🚫" },
    ],
  },
  {
    id: "panel-less-old",
    name: "Less Old Panel",
    category: "panel",
    painPoints: [
      { text: "Old processor. Less safe", emoji: "⚠️" },
      { text: "No new cameras. Can't add any Gen II or newer cameras with this panel", emoji: "📷" },
      { text: "Physical buttons. Clunky and less classy", emoji: "🔘" },
    ],
  },
];

const TIME_MANAGEMENT = [
  { time: "1:00 — 5:30", description: "Look for Upgrades and FP. Don't just hunt for upgrades. The best of the best do both" },
  { time: "5:30 — 8:00", description: "Hunt FP. Knock upgrades sparingly" },
  { time: "8:00 — dark thirty", description: "Look for both upgrades and FP. Don't just hunt for upgrades. The best of the best do both" },
];

const WHY_UPGRADES = [
  { icon: "🚀", text: "Momentum builder" },
  { icon: "🗺️", text: "Get to know the neighborhood/area you're selling in" },
  { icon: "📖", text: "Learn why other people bought what you want to sell" },
  { icon: "💬", text: "Gather stories & information about neighbors" },
  { icon: "📈", text: "Climb the payscale" },
  { icon: "🥯🚫", text: "No bagels" },
];

const PRMR_STEPS = [
  "Add total equipment you sell to the customer (do not include install fee or tax)",
  "Divide total equipment / 60",
  "Add $5 per NEW camera added (not a replacement camera)",
  "You now have the PRMR (payable recurring monthly revenue) for the upgrade",
  "Multiply PRMR x 4 to see upfront pay",
  "Multiply PRMR by your rate to see total pay",
];

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "doorbell": return Camera;
    case "outdoor": return Camera;
    case "indoor": return Camera;
    case "panel": return Monitor;
    default: return Home;
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case "doorbell": return "Doorbell";
    case "outdoor": return "Outdoor";
    case "indoor": return "Indoor";
    case "panel": return "Panel";
    default: return category;
  }
};

const UpgradeCheatSheet = () => {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const groupedProducts = PRODUCTS.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Upgrade Cheat Sheet</h1>
            <p className="text-xs text-muted-foreground">Know the pain points. Maximize upgrades.</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* AI Calculator CTA */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <button
              onClick={() => setCalculatorOpen(true)}
              className="w-full flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-2">
                  Calculate Upgrade PRMR
                  <Sparkles className="w-4 h-4 text-primary" />
                </h3>
                <p className="text-sm text-muted-foreground">AI-powered calculator for your upgrade commissions</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* What to Look For */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">What to Look For</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Know these pain points so you can understand why customers would want to upgrade.
          </p>

          {Object.entries(groupedProducts).map(([category, products]) => {
            const CategoryIcon = getCategoryIcon(category);
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 pt-2">
                  <CategoryIcon className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {getCategoryLabel(category)} Cameras
                  </h3>
                </div>
                <div className="grid gap-2">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-accent transition-all text-left group"
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <CategoryIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                            {product.name}
                          </h4>
                          {product.isUpgradeOpportunity && (
                            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-0">
                              Opportunity
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {product.painPoints.length} pain point{product.painPoints.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Management */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Time Management with Upgrades</CardTitle>
            </div>
            <CardDescription>Balance upgrades and new sales to maximize pay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {TIME_MANAGEMENT.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-28 flex-shrink-0">
                  <Badge variant="outline" className="font-mono text-xs">
                    {item.time}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Why Do Upgrades */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Why Do Upgrades</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {WHY_UPGRADES.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* How to Calculate Pay */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">How to Calculate Pay on Upgrades</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {PRMR_STEPS.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <Button
              onClick={() => setCalculatorOpen(true)}
              variant="outline"
              className="w-full mt-4"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Open PRMR Calculator
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Product Detail Drawer */}
      <Drawer open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DrawerContent className="max-h-[85dvh]">
          {selectedProduct && (
            <div className="flex flex-col h-full overflow-hidden">
              <DrawerHeader className="flex-shrink-0">
                <DrawerTitle className="flex items-center gap-3">
                  {selectedProduct.imageUrl ? (
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      {(() => {
                        const Icon = getCategoryIcon(selectedProduct.category);
                        return <Icon className="w-5 h-5 text-muted-foreground" />;
                      })()}
                    </div>
                  )}
                  <div>
                    <span>{selectedProduct.name}</span>
                    {selectedProduct.isUpgradeOpportunity && (
                      <Badge variant="secondary" className="ml-2 text-xs bg-emerald-500/10 text-emerald-600 border-0">
                        Opportunity
                      </Badge>
                    )}
                  </div>
                </DrawerTitle>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {selectedProduct.isUpgradeOpportunity ? "Upgrade Opportunities" : "Pain Points to Address"}
                  </p>
                  {selectedProduct.painPoints.map((point, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 p-4 rounded-xl border ${
                        selectedProduct.isUpgradeOpportunity 
                          ? "bg-emerald-500/5 border-emerald-500/20" 
                          : "bg-destructive/5 border-destructive/20"
                      }`}
                    >
                      {point.emoji && (
                        <span className="text-xl flex-shrink-0">{point.emoji}</span>
                      )}
                      <p className="text-sm">{point.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* PRMR Calculator */}
      <UpgradePrmrCalculator
        open={calculatorOpen}
        onOpenChange={setCalculatorOpen}
      />
    </div>
  );
};

export default UpgradeCheatSheet;
