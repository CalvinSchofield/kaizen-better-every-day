import { useState, useEffect, useRef, useMemo } from "react";
import { CheckCircle2, PackageCheck, Tablet, Shirt, IdCard, MessageSquare, AlertTriangle, Lightbulb, Sun, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useRampProgress } from "@/hooks/useRampProgress";
import type { RepData } from "@/hooks/useRepData";
import { TrainingSection } from "./TrainingSection";
import { PhaseCompleteCard } from "./PhaseCompleteCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { parseISO, isBefore } from "date-fns";

interface Phase4ContentProps {
  repData: RepData | null;
  isComplete: boolean;
  scrollToStepKey?: string | null;
  onScrollComplete?: () => void;
}

// Detect if the rep has an upcoming blitz
const useHasUpcomingBlitz = (repData: RepData | null) => {
  const committedBlitzIds = useMemo(() => {
    if (!repData?.committed_blitzes || !Array.isArray(repData.committed_blitzes)) return [];
    return (repData.committed_blitzes as any[]).map(b => typeof b === 'string' ? b : b?.id).filter(Boolean);
  }, [repData?.committed_blitzes]);

  const { data: blitzes } = useQuery({
    queryKey: ['upcoming-blitzes-for-packing', committedBlitzIds],
    enabled: committedBlitzIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('blitzes')
        .select('id, date, name')
        .in('id', committedBlitzIds);
      return data || [];
    }
  });

  return useMemo(() => {
    if (!blitzes || blitzes.length === 0) return { hasUpcoming: false, blitzName: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = blitzes.find(b => {
      const blitzDate = parseISO(b.date);
      return !isBefore(blitzDate, today);
    });
    return { hasUpcoming: !!upcoming, blitzName: upcoming?.name || null };
  }, [blitzes]);
};

// Summer packing list categories
const SUMMER_PACKING_LIST = {
  knocking: {
    title: "🚪 Knocking Essentials",
    items: [
      "iPad (with updated apps for work)",
      "iPad charger + charging cable",
      "Portable power bank (10,000+ mAh recommended)",
      "Lightweight knocking shoes (comfy, breathable)",
      "Work socks (5–7 pairs)",
      "Vivint jerseys",
      "Vivint hat",
      "Badge ID",
      "Lightweight work shorts (2–3 pairs)",
      "Small backpack or side bag for knocking (optional)",
      "Notebook + pen (or digital notes app)",
      "Reusable water bottle",
    ],
  },
  clothing: {
    title: "👕 Clothing",
    items: [
      "Casual clothes (4–6 shirts, 2–3 shorts)",
      "Gym clothes (2–3 sets)",
      "Hoodie or light jacket (cool evenings)",
      "Undergarments (7–10 pairs)",
      "Pajamas or sleepwear",
      "Church attire (1–2 outfits)",
      "Swimwear",
      "Slides or sandals",
      "Laundry bag + detergent pods (can buy there)",
    ],
  },
  bedding: {
    title: "🛌 Bedding",
    items: [
      "Twin bed sheet (can buy there)",
      "Blanket/comforter",
      "Pillow + pillowcase",
    ],
  },
  toiletries: {
    title: "🧼 Toiletries & Hygiene",
    items: [
      "Toothbrush + toothpaste",
      "Shower caddy or bag",
      "Shampoo, conditioner, soap/body wash",
      "Deodorant",
      "Razor + shaving cream",
      "Towel + hand towel",
      "Nail clippers, floss, etc.",
    ],
  },
  kitchen: {
    title: "🔪 Kitchen Extras",
    items: [
      "Cutting board",
      "Chef's knife or basic kitchen knife",
      "Can opener",
      "Measuring cup/spoons",
      "Mixing bowl",
      "Baking sheet or tray (if you'll use the oven)",
      "Basic seasonings (salt, pepper, garlic powder — starter kit)",
      "Ziploc bags or foil/wrap",
      "Microwave-safe bowl/cup",
      "Dish drying rack or mat",
      "Paper towels or cleaning cloths",
    ],
  },
  personal: {
    title: "🎧 Personal/Miscellaneous",
    items: [
      "Phone charger + extra cable (don't share iPad and iPhone charger)",
      "Wallet",
      "Sunscreen",
      "Ibuprofen/Tylenol & basic medicine",
      "Scriptures or study materials",
      "Journal or planner",
      "Portable speaker/headphones",
    ],
  },
};

// Blitz-specific packing list (shorter trip)
const BLITZ_PACKING_LIST = {
  knocking: {
    title: "🚪 Knocking Gear",
    items: [
      "iPad (charged, apps logged in)",
      "iPad charger & cable",
      "Portable battery pack",
      "ID Badge",
      "Vivint jerseys/polos",
      "Vivint hat",
      "Comfortable knocking shoes",
      "Work socks",
      "Lightweight work shorts (2–3 pairs)",
      "Sunglasses",
      "Sunscreen",
      "Water bottle",
    ],
  },
  clothing: {
    title: "👕 Clothing",
    items: [
      "Casual clothes for downtime",
      "Comfortable pants/shorts (khakis, joggers)",
      "Light jacket or hoodie (evening)",
      "Socks & underwear for each day",
      "Sleepwear",
    ],
  },
  personal: {
    title: "🎧 Personal Items",
    items: [
      "Phone & charger",
      "Wallet & ID",
      "Toiletries (toothbrush, deodorant, etc.)",
      "Any medications",
      "Earbuds/headphones",
      "Snacks for the car/doors",
    ],
  },
  niceToHave: {
    title: "✨ Nice to Have",
    items: [
      "Umbrella (just in case)",
      "Notebook & pen",
      "Pillow for car rides",
      "Book or entertainment",
    ],
  },
};

export const Phase4Content = ({ repData, isComplete, scrollToStepKey, onScrollComplete }: Phase4ContentProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>("packing");
  const [packingDone, setPackingDone] = useState(false);
  const [essentialsChecked, setEssentialsChecked] = useState(false);

  // Essentials checklist state
  const [hasIpad, setHasIpad] = useState(false);
  const [hasUniforms, setHasUniforms] = useState(false);
  const [hasBadge, setHasBadge] = useState(false);

  // Refs for scrolling
  const packingRef = useRef<HTMLDivElement>(null);
  const essentialsRef = useRef<HTMLDivElement>(null);

  const { saveProgress, updateIpadStatus } = useRampProgress(repData?.user_id);
  const { hasUpcoming, blitzName } = useHasUpcomingBlitz(repData);

  // Choose packing list based on context
  const packingList = hasUpcoming ? BLITZ_PACKING_LIST : SUMMER_PACKING_LIST;
  const packingTitle = hasUpcoming ? `Blitz Packing List${blitzName ? ` — ${blitzName}` : ''}` : "Summer Packing List";
  const packingDescription = hasUpcoming 
    ? "Everything you need for your blitz trip" 
    : "Everything you need for the summer";

  // Handle scroll to step
  useEffect(() => {
    if (!scrollToStepKey) return;

    const scrollAndExpand = () => {
      switch (scrollToStepKey) {
        case 'packing':
          setExpandedSection('packing');
          packingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        case 'essentials':
          setExpandedSection('essentials');
          essentialsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
      }
      onScrollComplete?.();
    };

    setTimeout(scrollAndExpand, 150);
  }, [scrollToStepKey, onScrollComplete]);

  // Load progress from watched_videos
  useEffect(() => {
    if (repData?.watched_videos && Array.isArray(repData.watched_videos)) {
      const watched = repData.watched_videos as string[];
      setPackingDone(watched.includes('phase4-packing-done'));
      setEssentialsChecked(watched.includes('phase4-essentials-checked'));
    }
    if (repData?.ipad_assigned) {
      setHasIpad(true);
    }
  }, [repData?.watched_videos, repData?.ipad_assigned]);

  const handlePackingDone = async () => {
    const success = await saveProgress('phase4-packing-done');
    if (success) {
      setPackingDone(true);
      toast({
        title: "Packing complete! 🎒",
        description: "Don't forget the essentials",
      });
    }
  };

  const handleIpadChange = async (checked: boolean) => {
    setHasIpad(checked);
    await updateIpadStatus(checked);
  };

  const handleTextLeaderMissing = () => {
    if (!repData?.team_leader_phone) {
      toast({
        title: "No leader phone found",
        description: "Contact your recruiter to get connected with your leader",
        variant: "destructive",
      });
      return;
    }

    const missing: string[] = [];
    if (!hasIpad) missing.push("iPad");
    if (!hasUniforms) missing.push("knocking uniforms");
    if (!hasBadge) missing.push("badge");

    const cleanPhone = repData.team_leader_phone.replace(/\D/g, '');
    const context = hasUpcoming ? "the blitz" : "the summer";
    const message = encodeURIComponent(
      `I'm getting ready for ${context} but I still need: ${missing.join(", ")}. Can you help me get these?`
    );
    
    window.location.href = `sms:${cleanPhone}?body=${message}`;
  };

  const handleEssentialsChecked = async () => {
    if (!hasIpad || !hasUniforms || !hasBadge) {
      toast({
        title: "Check all essentials first",
        description: "Make sure you have everything before marking complete",
        variant: "destructive",
      });
      return;
    }

    const success = await saveProgress('phase4-essentials-checked');
    if (success) {
      setEssentialsChecked(true);
      toast({
        title: "Essentials ready! ✅",
        description: "You've got everything you need",
      });
    }
  };

  const completedSteps = [packingDone, essentialsChecked].filter(Boolean).length;
  const allEssentialsHave = hasIpad && hasUniforms && hasBadge;
  const someMissing = !hasIpad || !hasUniforms || !hasBadge;

  // All steps done, waiting on leader to verify
  const allStepsDoneWaitingLeader = packingDone && essentialsChecked && !isComplete;

  return (
    <div className="space-y-5 pb-20">
      {/* Phase Complete - Waiting on Leader */}
      {allStepsDoneWaitingLeader && (
        <PhaseCompleteCard
          phaseNumber={4}
          teamLeaderPhone={repData?.team_leader_phone}
          teamLeaderName={repData?.team_leader}
        />
      )}

      {/* Completed Steps as Chips */}
      {completedSteps > 0 && completedSteps < 2 && !allStepsDoneWaitingLeader && (
        <div className="flex flex-wrap gap-2">
          {packingDone && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Packed
            </div>
          )}
          {essentialsChecked && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Essentials
            </div>
          )}
        </div>
      )}

      {/* Context indicator */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm",
        hasUpcoming 
          ? "bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400" 
          : "bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400"
      )}>
        {hasUpcoming ? <Flame className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        <span className="font-medium">
          {hasUpcoming ? `Preparing for blitz${blitzName ? `: ${blitzName}` : ''}` : "Preparing for the summer"}
        </span>
      </div>

      {/* Summer housing note */}
      {!hasUpcoming && (
        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground border border-border/50">
          <Lightbulb className="w-4 h-4 text-amber-500 inline mr-1.5" />
          The apartments come furnished with essentials like refrigerators, dishwashers, microwaves, ovens, mattresses, bed frames, couches, tables, chairs, washers, and dryers. Bring what you can and buy what you need. Share with roommates.
        </div>
      )}

      {/* Step 1: Packing List */}
      <div ref={packingRef} />
      <TrainingSection
        title={packingTitle}
        icon={<PackageCheck className="w-4 h-4" />}
        description={packingDescription}
        isComplete={packingDone}
        isExpanded={expandedSection === "packing"}
        onToggle={() => setExpandedSection(expandedSection === "packing" ? null : "packing")}
      >
        <div className="space-y-4">
          {Object.entries(packingList).map(([key, category]) => (
            <div key={key} className="space-y-2">
              <h5 className="font-medium text-sm">{category.title}</h5>
              <ul className="text-sm text-muted-foreground space-y-1 ml-2">
                {category.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-muted-foreground/50 mt-0.5">☐</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {!packingDone && (
            <Button 
              className="w-full mt-3"
              onClick={handlePackingDone}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I've Packed Everything
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Step 2: Knocking Essentials */}
      <div ref={essentialsRef} />
      <TrainingSection
        title="Knocking Essentials Check"
        icon={<Tablet className="w-4 h-4" />}
        description="Triple-check your must-haves"
        isComplete={essentialsChecked}
        isLocked={!packingDone}
        isExpanded={expandedSection === "essentials"}
        onToggle={() => setExpandedSection(expandedSection === "essentials" ? null : "essentials")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Make absolutely sure you have these essentials:
          </p>

          <div className="space-y-3">
            {/* iPad */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Checkbox
                id="ipad"
                checked={hasIpad}
                onCheckedChange={handleIpadChange}
              />
              <div className="flex-1">
                <label htmlFor="ipad" className="flex items-center gap-2 font-medium text-sm cursor-pointer">
                  <Tablet className="w-4 h-4" />
                  iPad (set up and ready)
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  With Vivint app installed and logged in
                </p>
              </div>
            </div>

            {/* Uniforms */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Checkbox
                id="uniforms"
                checked={hasUniforms}
                onCheckedChange={(checked) => setHasUniforms(checked === true)}
              />
              <div className="flex-1">
                <label htmlFor="uniforms" className="flex items-center gap-2 font-medium text-sm cursor-pointer">
                  <Shirt className="w-4 h-4" />
                  Knocking Uniforms
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Professional polo/shirt for door knocking
                </p>
              </div>
            </div>

            {/* Badge */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Checkbox
                id="badge"
                checked={hasBadge}
                onCheckedChange={(checked) => setHasBadge(checked === true)}
              />
              <div className="flex-1">
                <label htmlFor="badge" className="flex items-center gap-2 font-medium text-sm cursor-pointer">
                  <IdCard className="w-4 h-4" />
                  ID Badge
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Your official Vivint rep badge
                </p>
              </div>
            </div>
          </div>

          {someMissing && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Missing essentials?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Text your leader to get what you need.
                  </p>
                </div>
              </div>
              <Button 
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={handleTextLeaderMissing}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Text Leader About Missing Items
              </Button>
            </div>
          )}

          {allEssentialsHave && !essentialsChecked && (
            <Button 
              className="w-full"
              onClick={handleEssentialsChecked}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              All Essentials Ready
            </Button>
          )}
        </div>
      </TrainingSection>

      {/* Completion Celebration */}
      {isComplete && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-bold mb-2">You're Ready!</h3>
            <p className="text-sm text-muted-foreground">
              You've completed all preparation. Time to go crush it!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
