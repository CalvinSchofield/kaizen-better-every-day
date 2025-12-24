import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useHeader } from "@/contexts/HeaderContext";
import { closesData, closesIntro } from "./closesData";

interface ClosesGuideProps {
  onBack?: () => void;
}

export const ClosesGuide = ({ onBack }: ClosesGuideProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedCloses, setExpandedCloses] = useState<string[]>([]);
  const { setCustomTitle } = useHeader();

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

  const totalCloses = closesData.reduce((acc, cat) => acc + cat.closes.length, 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Back button */}
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Training
        </Button>
      )}

      {/* Hero */}
      <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg">Multiple Ways to Seal the Deal</h3>
              <p className="text-sm text-muted-foreground">{totalCloses} closes to master</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intro text */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 text-sm text-muted-foreground leading-relaxed">
          <p>{closesIntro}</p>
        </CardContent>
      </Card>

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
                                <ChevronDown className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                                  expandedCloses.includes(close.name) && "rotate-180"
                                )} />
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
    </div>
  );
};
