import { useState } from "react";
import { ChevronLeft, Play, ExternalLink, ChevronDown, ChevronRight, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { PitchGuide } from "./PitchGuide";
import { inHomeSections, closesData } from "./inHomePitchData";

interface InHomePitchGuideProps {
  onBack?: () => void;
}

const VIDEO_URL = "https://dthvivinttraining.conveyour.com/ui/portal/course/682b650d0866a26ac3318a1f/lesson/682b665eae62a2345d538e1a";

export const InHomePitchGuide = ({ onBack }: InHomePitchGuideProps) => {
  const [showClosesBonus, setShowClosesBonus] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [expandedCloses, setExpandedCloses] = useState<string[]>([]);

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

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Back button */}
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Training
        </Button>
      )}

      {/* Video Hero Banner */}
      <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <a
          href={VIDEO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Play className="w-7 h-7 text-primary ml-1" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg">Watch Full Sales Sample</h3>
                <p className="text-sm text-muted-foreground">See the complete in-home presentation</p>
              </div>
              <ExternalLink className="w-5 h-5 text-primary flex-shrink-0" />
            </div>
          </CardContent>
        </a>
      </Card>

      {/* Main Pitch Guide Component */}
      <PitchGuide
        sections={inHomeSections}
        pageTitle="In-Home Presentation"
        audioSrc="/audio/in-home-presentation.m4a"
      />

      {/* BONUS: Closes Cheat Sheet */}
      <Collapsible open={showClosesBonus} onOpenChange={setShowClosesBonus}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                    <Gift className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">BONUS: Closes Cheat Sheet</h3>
                    <p className="text-sm text-muted-foreground">12 closes to seal the deal</p>
                  </div>
                </div>
                <ChevronDown className={cn(
                  "w-5 h-5 text-muted-foreground transition-transform",
                  showClosesBonus && "rotate-180"
                )} />
              </div>
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="space-y-3 pt-3">
            {/* Intro text */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 text-sm text-muted-foreground">
                <p>
                  It takes different closes to close different people! Study these and 
                  memorize as many as you can. If someone let you in their house and 
                  presented, they're interested - be the person that can make it happen!
                </p>
              </CardContent>
            </Card>

            {/* Close Categories */}
            {closesData.map((category) => (
              <Collapsible
                key={category.title}
                open={expandedCategories.includes(category.title)}
                onOpenChange={() => toggleCategory(category.title)}
              >
                <CollapsibleTrigger asChild>
                  <Card className={cn(
                    "cursor-pointer transition-colors hover:bg-accent/50",
                    expandedCategories.includes(category.title) && "border-primary/50"
                  )}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <span className="text-xl">{category.emoji}</span>
                      <span className="flex-1 font-medium">{category.title}</span>
                      <span className="text-xs text-muted-foreground">{category.closes.length} closes</span>
                      <ChevronRight className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        expandedCategories.includes(category.title) && "rotate-90"
                      )} />
                    </CardContent>
                  </Card>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="pl-4 pt-2 space-y-2">
                    {category.closes.map((close) => (
                      <Collapsible
                        key={close.name}
                        open={expandedCloses.includes(close.name)}
                        onOpenChange={() => toggleClose(close.name)}
                      >
                        <CollapsibleTrigger asChild>
                          <button className="w-full text-left p-3 rounded-lg bg-card border hover:bg-accent/30 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{close.name}</p>
                                <p className="text-xs text-muted-foreground">{close.description}</p>
                              </div>
                              <ChevronDown className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-2",
                                expandedCloses.includes(close.name) && "rotate-180"
                              )} />
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="mt-2 p-3 rounded-lg bg-primary/5 border-l-4 border-primary">
                            <p className="text-sm leading-relaxed whitespace-pre-line">
                              {close.script}
                            </p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
