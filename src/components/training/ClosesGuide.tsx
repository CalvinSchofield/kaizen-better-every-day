import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useHeader } from "@/contexts/HeaderContext";
import { closesData, closesIntro, CloseItem } from "./closesData";

interface ClosesGuideProps {
  onBack?: () => void;
}

const FAVORITES_KEY = "closes-favorites";

export const ClosesGuide = ({ onBack }: ClosesGuideProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedCloses, setExpandedCloses] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  const { setCustomTitle } = useHeader();

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    setCustomTitle("Closes");
    return () => setCustomTitle(null);
  }, [setCustomTitle]);

  const toggleCategory = (title: string) => {
    setExpandedCategories(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const toggleClose = (name: string) => {
    setExpandedCloses(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const toggleFavorite = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const isFavorite = (name: string) => favorites.includes(name);

  // Get all favorited closes as a flat list
  const getFavoriteCloses = (): (CloseItem & { categoryEmoji: string })[] => {
    const result: (CloseItem & { categoryEmoji: string })[] = [];
    closesData.forEach(category => {
      category.closes.forEach(close => {
        if (favorites.includes(close.name)) {
          result.push({ ...close, categoryEmoji: category.emoji });
        }
      });
    });
    return result;
  };

  // Filter closes based on search
  const filteredData = searchQuery.trim()
    ? closesData
        .map(category => ({
          ...category,
          closes: category.closes.filter(
            close =>
              close.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              close.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              close.script.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter(category => category.closes.length > 0)
    : closesData;

  const favoriteCloses = getFavoriteCloses().filter(
    close =>
      !searchQuery.trim() ||
      close.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      close.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      close.script.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Back button */}
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Training
        </Button>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search closes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Intro text */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground leading-relaxed">
          <p>{closesIntro}</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "favorites")}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            All Closes
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex-1 gap-1.5">
            <Star className="h-3.5 w-3.5" />
            Favorites {favorites.length > 0 && `(${favorites.length})`}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Favorites Tab */}
      {activeTab === "favorites" && (
        <div className="space-y-2">
          {favoriteCloses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No favorites yet</p>
              <p className="text-sm mt-1">Tap the star on any close to save it here</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {favoriteCloses.map((close, idx) => (
                <motion.div
                  key={close.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Collapsible
                    open={expandedCloses.includes(close.name)}
                    onOpenChange={() => toggleClose(close.name)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className={cn(
                        "w-full text-left p-4 rounded-xl bg-card border transition-all",
                        expandedCloses.includes(close.name)
                          ? "border-primary/50 shadow-sm"
                          : "hover:bg-accent/30"
                      )}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg">{close.categoryEmoji}</span>
                            <div className="min-w-0">
                              <p className="font-medium">{close.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{close.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => toggleFavorite(close.name, e)}
                              className="p-1.5 rounded-full hover:bg-accent transition-colors"
                            >
                              <Star className="h-4 w-4 fill-primary text-primary" />
                            </button>
                            <ChevronDown className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              expandedCloses.includes(close.name) && "rotate-180"
                            )} />
                          </div>
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2 p-4 rounded-xl bg-primary/5 border-l-4 border-primary"
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-line">
                          {close.script}
                        </p>
                      </motion.div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* All Closes Tab */}
      {activeTab === "all" && (
        <>
          {/* Categories */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredData.map((category, categoryIdx) => (
                <motion.div
                  key={category.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: categoryIdx * 0.05 }}
                >
                  <Collapsible
                    open={expandedCategories.includes(category.title)}
                    onOpenChange={() => toggleCategory(category.title)}
                  >
                    <CollapsibleTrigger asChild>
                      <Card className={cn(
                        "cursor-pointer transition-all hover:bg-accent/50",
                        expandedCategories.includes(category.title) && "border-primary/50 bg-primary/5"
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{category.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold">{category.title}</h4>
                              <p className="text-xs text-muted-foreground">{category.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {category.closes.length}
                              </span>
                              <ChevronRight className={cn(
                                "h-5 w-5 text-muted-foreground transition-transform",
                                expandedCategories.includes(category.title) && "rotate-90"
                              )} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="pt-2 space-y-2">
                        {category.closes.map((close, closeIdx) => (
                          <motion.div
                            key={close.name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: closeIdx * 0.03 }}
                          >
                            <Collapsible
                              open={expandedCloses.includes(close.name)}
                              onOpenChange={() => toggleClose(close.name)}
                            >
                              <CollapsibleTrigger asChild>
                                <button className={cn(
                                  "w-full text-left p-4 rounded-xl bg-card border transition-all",
                                  expandedCloses.includes(close.name)
                                    ? "border-primary/50 shadow-sm"
                                    : "hover:bg-accent/30"
                                )}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="font-medium">{close.name}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">{close.description}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <button
                                        onClick={(e) => toggleFavorite(close.name, e)}
                                        className="p-1.5 rounded-full hover:bg-accent transition-colors"
                                      >
                                        <Star className={cn(
                                          "h-4 w-4 transition-colors",
                                          isFavorite(close.name)
                                            ? "fill-primary text-primary"
                                            : "text-muted-foreground"
                                        )} />
                                      </button>
                                      <ChevronDown className={cn(
                                        "h-4 w-4 text-muted-foreground transition-transform",
                                        expandedCloses.includes(close.name) && "rotate-180"
                                      )} />
                                    </div>
                                  </div>
                                </button>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  className="mt-2 p-4 rounded-xl bg-primary/5 border-l-4 border-primary"
                                >
                                  <p className="text-sm leading-relaxed whitespace-pre-line">
                                    {close.script}
                                  </p>
                                </motion.div>
                              </CollapsibleContent>
                            </Collapsible>
                          </motion.div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredData.length === 0 && searchQuery && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No closes found for "{searchQuery}"</p>
              </div>
            )}
          </div>

          {/* Expand/Collapse All */}
          {!searchQuery && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (expandedCategories.length === closesData.length) {
                    setExpandedCategories([]);
                    setExpandedCloses([]);
                  } else {
                    setExpandedCategories(closesData.map(c => c.title));
                  }
                }}
              >
                {expandedCategories.length === closesData.length ? "Collapse all" : "Expand all"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
