import { useState, useMemo } from "react";
import { ArrowLeft, Search, X, ChevronRight, Star, Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { COMPETITORS, CompetitorData } from "@/data/competitorData";
import { CompetitorGuide } from "@/components/competitors/CompetitorGuide";

const CATEGORIES = [
  { label: "All", value: "all" },
  { label: "Cameras", value: "cameras" },
  { label: "Alarm", value: "alarm" },
  { label: "Panels", value: "panels" },
] as const;

export default function Competitors() {
  const navigate = useNavigate();
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useLocalStorage<string[]>("competitor-favorites", []);
  const [isAiMode, setIsAiMode] = useState(false);
  const { toast } = useToast();
  
  // AI recommendation state
  const [aiInput, setAiInput] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [aiCompetitorIds, setAiCompetitorIds] = useState<string[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const handleAiRecommendation = async () => {
    if (!aiInput.trim()) return;
    
    setIsLoadingAi(true);
    setAiRecommendation("");
    setAiCompetitorIds([]);
    
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke('recommend-competitor', {
        body: { situation: aiInput, competitors: COMPETITORS }
      });

      if (functionError) throw functionError;
      
      setAiRecommendation(functionData.recommendation);
      // Map returned competitor names to IDs
      const matchedIds = (functionData.competitors || [])
        .map((c: { name: string }) => COMPETITORS.find(comp => comp.name.toLowerCase().includes(c.name.toLowerCase()))?.id)
        .filter(Boolean);
      setAiCompetitorIds(matchedIds);
    } catch (error: any) {
      console.error('AI recommendation error:', error);
      toast({
        title: "AI Error",
        description: error.message || "Failed to get AI recommendation",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAi(false);
    }
  };

  const toggleFavorite = (competitorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = favorites.includes(competitorId) 
      ? favorites.filter(id => id !== competitorId)
      : [...favorites, competitorId];
    setFavorites(newFavorites);
  };

  const toggleExpand = (competitorId: string) => {
    setExpandedId(prev => prev === competitorId ? null : competitorId);
  };

  // Filter and sort competitors
  const filteredCompetitors = useMemo(() => {
    let filtered = [...COMPETITORS];
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.ourSellingPoints.some(p => p.toLowerCase().includes(query))
      );
    }
    
    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }
    
    // Sort: favorites first, then alphabetically
    return filtered.sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 0 : 1;
      const bFav = favorites.includes(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, selectedCategory, favorites]);

  // Show detail view if competitor selected
  if (selectedCompetitor) {
    return (
      <CompetitorGuide 
        competitor={selectedCompetitor} 
        onBack={() => setSelectedCompetitor(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div 
        className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50"
        style={{ paddingTop: 'var(--effective-safe-area-top)' }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tools")} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Competitor Cheat Sheet</h1>
              <p className="text-xs text-muted-foreground">Know what you're up against</p>
            </div>
          </div>

          {/* Search/AI Input */}
          <div className="relative mb-3">
            {isAiMode ? (
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            )}
            <Input
              placeholder={isAiMode ? "What do you see on their door?" : "Search competitors..."}
              value={isAiMode ? aiInput : searchQuery}
              onChange={(e) => isAiMode ? setAiInput(e.target.value) : setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isAiMode && handleAiRecommendation()}
              className="pl-9 pr-20 h-11 bg-muted/50 border-0 rounded-xl"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {(isAiMode ? aiInput : searchQuery) && (
                <button onClick={() => isAiMode ? setAiInput("") : setSearchQuery("")} className="p-1.5 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  if (isAiMode && aiInput.trim()) {
                    handleAiRecommendation();
                  } else {
                    setIsAiMode(!isAiMode);
                    setAiInput("");
                    setSearchQuery("");
                    setAiRecommendation("");
                  }
                }}
                disabled={isAiMode && isLoadingAi}
                className={`p-1.5 rounded-lg transition-colors ${isAiMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                {isLoadingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* AI Recommendation */}
          <AnimatePresence>
            {aiRecommendation && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-3 pb-3 space-y-3">
                    <div className="text-sm" dangerouslySetInnerHTML={{ __html: aiRecommendation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                    {aiCompetitorIds.length > 0 && (
                      <div className="flex gap-2">
                        {aiCompetitorIds.map((id) => {
                          const comp = COMPETITORS.find(c => c.id === id);
                          return comp ? (
                            <button key={id} onClick={() => setSelectedCompetitor(comp)} className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 text-sm font-semibold">
                              View {comp.name.split(' ').slice(0, 2).join(' ')}
                            </button>
                          ) : null;
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Competitor List */}
      <div className="px-4 py-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredCompetitors.map((competitor) => {
            const isExpanded = expandedId === competitor.id;
            const isFavorite = favorites.includes(competitor.id);
            
            return (
              <motion.div
                key={competitor.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                {/* Card Header */}
                <div onClick={() => toggleExpand(competitor.id)} className="flex items-center gap-4 p-4 cursor-pointer">
                  <div className="shrink-0">
                    <img
                      src={competitor.image}
                      alt={competitor.name}
                      className="w-16 h-16 object-contain rounded-xl bg-muted/50"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm leading-tight">{competitor.name}</h3>
                      {isFavorite && <Star className="w-4 h-4 fill-primary text-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{competitor.ourSellingPoints.length} selling points</p>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3">
                        {/* Quick Preview */}
                        <div className="bg-primary/5 rounded-xl p-3">
                          <p className="text-xs font-medium text-primary mb-2">Top Selling Points:</p>
                          <ul className="space-y-1">
                            {competitor.ourSellingPoints.slice(0, 3).map((point, idx) => (
                              <li key={idx} className="text-xs flex gap-2">
                                <span className="text-primary">•</span>
                                <span className="line-clamp-1">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={(e) => toggleFavorite(competitor.id, e)} className={`flex-1 rounded-xl ${isFavorite ? "bg-primary/10 border-primary/30" : ""}`}>
                            <Star className={`w-4 h-4 mr-2 ${isFavorite ? "fill-primary text-primary" : ""}`} />
                            {isFavorite ? "Saved" : "Save"}
                          </Button>
                          <Button variant="default" size="sm" onClick={() => setSelectedCompetitor(competitor)} className="flex-1 rounded-xl">
                            View Details →
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
