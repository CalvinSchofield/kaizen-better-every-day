import { useState } from "react";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useCompetitors, Competitor } from "@/hooks/useCompetitors";
import { CompetitorDetailSheet } from "@/components/CompetitorDetailSheet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Competitors() {
  const navigate = useNavigate();
  const { competitors, loading, error, syncFromNotion } = useCompetitors();
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
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSync}
              disabled={syncing}
              className="rounded-full"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* AI Recommendation */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="What do you see on their door? (e.g., 'Ring doorbell, blue ADT sign')"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAiRecommendation()}
                className="flex-1"
              />
              <Button 
                onClick={handleAiRecommendation}
                disabled={isLoadingAi || !aiInput.trim()}
                size="icon"
              >
                {isLoadingAi ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="text-sm">✨</span>
                )}
              </Button>
            </div>
            {aiRecommendation && (
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
            )}
          </div>
        </div>
      </div>

      {/* Competitor Grid */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sortedCompetitors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No competitors available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {sortedCompetitors.map((competitor) => (
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
