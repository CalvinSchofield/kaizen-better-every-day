import { useState } from "react";
import { ChevronLeft, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PitchGuide } from "./PitchGuide";
import { paperworkSections } from "./paperworkData";

interface PaperworkGuideProps {
  onBack?: () => void;
}

export const PaperworkGuide = ({ onBack }: PaperworkGuideProps) => {
  const [showPSAPreview, setShowPSAPreview] = useState(false);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Back button */}
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Training
        </Button>
      )}

      {/* Main Pitch Guide Component */}
      <PitchGuide
        sections={paperworkSections}
        pageTitle="Smooth Paperwork Process"
        audioSrc="/audio/smooth-paperwork.m4a"
      />

      {/* PSA Preview Card */}
      <Card 
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setShowPSAPreview(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">Preview the PSA</h3>
              <p className="text-sm text-muted-foreground">See what customers sign before your first one</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PSA Preview Modal/Fullscreen */}
      {showPSAPreview && (
        <div className="fixed inset-0 z-50 bg-background">
          {/* Header */}
          <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold">PSA Document</h2>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowPSAPreview(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* PDF Viewer */}
          <div className="h-[calc(100vh-57px)]">
            <iframe
              src="/documents/PSA.pdf"
              className="w-full h-full"
              title="PSA Document Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
};
