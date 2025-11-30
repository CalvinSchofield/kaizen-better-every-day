import { useState } from "react";
import { ArrowLeft, Search, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompetitors, Competitor } from "@/hooks/useCompetitors";
import { CompetitorDetailSheet } from "@/components/CompetitorDetailSheet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Competitors() {
  const navigate = useNavigate();
  const { competitors, loading, error, syncFromNotion } = useCompetitors();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  
  // AI recommendation state
  const [aiInput, setAiInput] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [aiCompetitors, setAiCompetitors] = useState<Array<{ name: string; notion_page_id: string }>>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncFromNotion();
      toast({
        title: "Sync Complete!",
        description: "Competitor data has been updated from Notion",
      });
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync competitors from Notion",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

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
    }
  };

  // Sort competitors by category (cameras, alarm, panels) then alphabetically
  const sortedCompetitors = [...competitors].sort((a, b) => {
    const categoryOrder: { [key: string]: number } = {
      'cameras': 1,
      'alarm': 2,
      'panels': 3,
    };
    
    const categoryA = a.category?.toLowerCase() || '';
    const categoryB = b.category?.toLowerCase() || '';
    
    // Get category priority (default to 999 for unknown categories)
    const priorityA = categoryOrder[categoryA] || 999;
    const priorityB = categoryOrder[categoryB] || 999;
    
    // First sort by category
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Then sort alphabetically by name
    return a.name.localeCompare(b.name);
  });

  const filteredCompetitors = sortedCompetitors.filter((comp) =>
    comp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/tools")}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Competitor Cheat Sheet</h1>
              <p className="text-sm text-muted-foreground">
                Quick reference for competitor products
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSync}
              disabled={syncing}
              className="rounded-full"
            >
              <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* AI Input Section */}
          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  placeholder="What do you see on their door? (e.g., 'Ring doorbell, blue ADT sign')"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiRecommendation()}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={handleAiRecommendation}
                disabled={isLoadingAi || !aiInput.trim()}
                size="icon"
                className="shrink-0"
              >
                {isLoadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
            
            {/* AI Recommendation Display */}
            {aiRecommendation && (
              <div className="bg-primary/10 rounded-lg p-4 space-y-3">
                <p className="text-sm text-foreground">{aiRecommendation}</p>
                {aiCompetitors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {aiCompetitors.map((comp, idx) => (
                      <Button
                        key={idx}
                        onClick={() => openCompetitorByNotionId(comp.notion_page_id)}
                        variant="default"
                        size="sm"
                        className="text-xs"
                      >
                        View {comp.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Offline Indicator */}
          {error?.includes('offline') && (
            <div className="mt-3 px-3 py-2 bg-accent/50 rounded-lg flex items-center gap-2 text-sm">
              <span className="text-accent-foreground/80">📡 Showing cached data (offline)</span>
            </div>
          )}
        </div>
      </div>

      {/* Competitor Grid */}
      <div className="max-w-6xl mx-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCompetitors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? "No competitors found matching your search." : "No competitors available yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredCompetitors.map((competitor) => (
              <button
                key={competitor.id}
                onClick={() => setSelectedCompetitor(competitor)}
                className="group relative bg-card rounded-xl overflow-hidden border border-border hover:border-primary transition-all duration-200 hover:shadow-lg"
              >
                {/* Image */}
                <div className="aspect-square bg-muted flex items-center justify-center p-4">
                  {competitor.main_image_url ? (
                    <img
                      src={competitor.main_image_url}
                      alt={competitor.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-4xl text-muted-foreground">📷</div>
                  )}
                </div>

                {/* Name */}
                <div className="p-3 bg-card">
                  <h3 className="font-semibold text-sm text-left line-clamp-2 group-hover:text-primary transition-colors">
                    {competitor.name}
                  </h3>
                  {competitor.category && (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {competitor.category}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
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
