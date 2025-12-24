import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, Loader2, Search, X, ChevronDown, Star, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCompetitors, Competitor } from "@/hooks/useCompetitors";
import { CompetitorDetailSheet } from "@/components/CompetitorDetailSheet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { motion, AnimatePresence } from "framer-motion";

// Category display names mapped to database values
const CATEGORIES = [
  { label: "All", value: "all" },
  { label: "Cameras", value: "cameras" },
  { label: "Alarm", value: "alarm service (monthly)" },
  { label: "Panels", value: "panels & equipment" },
] as const;

export default function Competitors() {
  const navigate = useNavigate();
  const { competitors, loading } = useCompetitors();
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useLocalStorage<string[]>("competitor-favorites", []);
  const [isAiMode, setIsAiMode] = useState(false);
  const { toast } = useToast();
  
  // AI recommendation state
  const [aiInput, setAiInput] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [aiCompetitors, setAiCompetitors] = useState<Array<{ name: string; notion_page_id: string }>>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const handleAiRecommendation = async () => {
    if (!aiInput.trim()) return;
    
    setIsLoadingAi(true);
    setAiRecommendation("");
    setAiCompetitors([]);
    
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke('recommend-competitor', {
        body: { situation: aiInput, competitors: competitors }
      });

      if (functionError) throw functionError;
      
      setAiRecommendation(functionData.recommendation);
      setAiCompetitors(functionData.competitors || []);
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

  const openCompetitorByNotionId = (notionPageId: string) => {
    const competitor = competitors.find(c => c.notion_page_id === notionPageId);
    if (competitor) {
      setSelectedCompetitor(competitor);
    } else {
      toast({
        title: "Competitor not found",
        description: "Unable to locate this competitor.",
        variant: "destructive",
      });
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
    let filtered = [...competitors];
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.category?.toLowerCase().includes(query) ||
        c.our_selling_points.some(p => p.toLowerCase().includes(query))
      );
    }
    
    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(c => 
        c.category?.toLowerCase() === selectedCategory
      );
    }
    
    // Sort: favorites first, then by category order, then alphabetically
    const categoryOrder: { [key: string]: number } = {
      'cameras': 1,
      'alarm service (monthly)': 2,
      'panels & equipment': 3,
    };
    
    return filtered.sort((a, b) => {
      // Favorites first
      const aFav = favorites.includes(a.id) ? 0 : 1;
      const bFav = favorites.includes(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      
      // Then by category
      const priorityA = categoryOrder[a.category?.toLowerCase() || ''] || 999;
      const priorityB = categoryOrder[b.category?.toLowerCase() || ''] || 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [competitors, searchQuery, selectedCategory, favorites]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/tools")}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl font-bold">Competitor Cheat Sheet</h1>
            </div>
          </div>

          {/* Unified Search/AI Input */}
          <div className="space-y-2 mb-3">
            <div className="relative">
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
                onFocus={(e) => e.target.select()}
                className="pl-9 pr-20 h-11 bg-muted/50 border-0 rounded-xl"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {(isAiMode ? aiInput : searchQuery) && (
                  <button
                    onClick={() => isAiMode ? setAiInput("") : setSearchQuery("")}
                    className="p-1.5 text-muted-foreground hover:text-foreground"
                  >
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
                    }
                  }}
                  disabled={isAiMode && isLoadingAi}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isAiMode 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {isLoadingAi ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            
            <AnimatePresence>
              {aiRecommendation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-3 pb-3 space-y-3">
                      <div 
                        className="text-sm text-foreground prose prose-sm max-w-none prose-strong:text-foreground prose-strong:font-semibold"
                        dangerouslySetInnerHTML={{ 
                          __html: aiRecommendation
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/- (.*?)(?=\n|$)/g, '• $1')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                      {aiCompetitors.length > 0 && (
                        <div className="flex gap-2 pt-1">
                          {aiCompetitors.map((comp, idx) => (
                            <button
                              key={idx}
                              onClick={() => openCompetitorByNotionId(comp.notion_page_id)}
                              className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm font-semibold shadow-sm"
                            >
                              View {comp.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
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
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCompetitors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? "No competitors match your search." : "No competitors available yet."}
            </p>
          </div>
        ) : (
          filteredCompetitors.map((competitor) => {
            const isExpanded = expandedId === competitor.id;
            const isFavorite = favorites.includes(competitor.id);
            
            return (
              <motion.div
                key={competitor.id}
                layout
                className={`rounded-2xl border overflow-hidden transition-colors ${
                  isFavorite 
                    ? "bg-primary/5 border-primary/30" 
                    : "bg-card border-border"
                }`}
              >
                {/* Collapsed Header */}
                <button
                  onClick={() => toggleExpand(competitor.id)}
                  className="w-full flex items-center gap-3 p-4"
                >
                  {/* Image */}
                  <div className="w-12 h-12 rounded-xl bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {competitor.main_image_url ? (
                      <img
                        src={competitor.main_image_url}
                        alt={competitor.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xl text-muted-foreground">📷</span>
                    )}
                  </div>
                  
                  {/* Name & Category */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{competitor.name}</h3>
                      {isFavorite && (
                        <Star className="w-4 h-4 fill-primary text-primary" />
                      )}
                    </div>
                    {competitor.category && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {competitor.category}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Chevron */}
                  <ChevronDown 
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`} 
                  />
                </button>
                
                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4">
                        {/* Our Selling Points */}
                        {competitor.our_selling_points.length > 0 && (
                          <div className="bg-accent/50 rounded-xl p-4">
                            <h4 className="text-sm font-bold text-accent-foreground mb-2 flex items-center gap-2">
                              🎯 OUR SELLING POINTS
                            </h4>
                            <ul className="space-y-1.5">
                              {competitor.our_selling_points.map((point, idx) => (
                                <li key={idx} className="flex gap-2 text-sm">
                                  <span className="text-muted-foreground">•</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => toggleFavorite(competitor.id, e)}
                            className={`flex-1 rounded-xl ${isFavorite ? "bg-primary/10 border-primary/30" : ""}`}
                          >
                            <Star className={`w-4 h-4 mr-2 ${isFavorite ? "fill-primary text-primary" : ""}`} />
                            {isFavorite ? "Favorited" : "Favorite"}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setSelectedCompetitor(competitor)}
                            className="flex-1 rounded-xl"
                          >
                            More Details →
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Detail Sheet */}
      {selectedCompetitor && (
        <CompetitorDetailSheet
          competitor={selectedCompetitor}
          open={!!selectedCompetitor}
          onOpenChange={(open) => !open && setSelectedCompetitor(null)}
        />
      )}
    </div>
  );
}