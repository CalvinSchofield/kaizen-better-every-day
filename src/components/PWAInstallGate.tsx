import { useState } from "react";
import { Download, ChevronDown, ChevronUp, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const PWAInstallGate = () => {
  const [gifExpanded, setGifExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Install Kaizen First
          </CardTitle>
          <CardDescription>
            To use Kaizen, please install it on your device for the best experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              Why Install?
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Works offline for tracking in the field</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Faster loading and smoother experience</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Quick access from your home screen</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Save battery with optimized performance</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Installation Steps:</h3>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <p>Tap the <strong>Share</strong> button at the bottom of Safari</p>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <p>Scroll down and tap <strong>Add to Home Screen</strong></p>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <p>Tap <strong>Add</strong> in the top right corner</p>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  4
                </div>
                <p>Open Kaizen from your home screen to continue</p>
              </div>
            </div>
          </div>

          <Collapsible open={gifExpanded} onOpenChange={setGifExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                {gifExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide Visual Guide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show Visual Guide
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="rounded-lg overflow-hidden border border-border bg-muted">
                <img 
                  src="/install-guide.gif" 
                  alt="Installation guide"
                  className="w-full"
                  loading="lazy"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
};
