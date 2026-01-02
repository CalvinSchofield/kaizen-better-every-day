import { useState } from "react";
import { ArrowLeft, Target, Shield, MessageSquare, Layers, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { CompetitorData } from "@/data/competitorData";

interface CompetitorGuideProps {
  competitor: CompetitorData;
  onBack: () => void;
}

export const CompetitorGuide = ({ competitor, onBack }: CompetitorGuideProps) => {
  const [activeTab, setActiveTab] = useState("beat");

  const categoryLabel = {
    cameras: "Camera",
    alarm: "Alarm Service",
    panels: "Panel/Equipment",
  }[competitor.category];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b"
        style={{ paddingTop: 'var(--effective-safe-area-top)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-lg truncate">{competitor.name}</h1>
            <Badge variant="secondary" className="text-xs">{categoryLabel}</Badge>
          </div>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative w-full aspect-square max-h-[280px] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center overflow-hidden">
        <img 
          src={competitor.image} 
          alt={competitor.name}
          className="w-full h-full object-contain p-8"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder.svg';
          }}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[57px] z-10 bg-background border-b px-4">
          <TabsList className="w-full grid grid-cols-4 h-12">
            <TabsTrigger value="beat" className="text-xs px-1">Beat It</TabsTrigger>
            <TabsTrigger value="know" className="text-xs px-1">Know It</TabsTrigger>
            <TabsTrigger value="handle" className="text-xs px-1" disabled={competitor.objections.length === 0}>
              Handle It
            </TabsTrigger>
            <TabsTrigger value="versions" className="text-xs px-1" disabled={!competitor.alternateVersions?.length}>
              Versions
            </TabsTrigger>
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          {/* Beat It Tab - Our Selling Points */}
          <TabsContent value="beat" className="mt-0 px-4 py-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Why Vivint Wins
                  </h3>
                  <ul className="space-y-3">
                    {competitor.ourSellingPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Know It Tab - Their Selling Points */}
          <TabsContent value="know" className="mt-0 px-4 py-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Why They Bought It
                  </h3>
                  <ul className="space-y-2">
                    {competitor.theirSellingPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span>•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {competitor.monitoringCompanies && competitor.monitoringCompanies.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3">Monitoring Companies</h3>
                    <div className="flex flex-wrap gap-2">
                      {competitor.monitoringCompanies.map((company, idx) => (
                        <Badge key={idx} variant="outline">{company}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Handle It Tab - Objections */}
          <TabsContent value="handle" className="mt-0 px-4 py-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-accent" />
                    Common Objections
                  </h3>
                  <div className="space-y-4">
                    {competitor.objections.map((obj, idx) => (
                      <div key={idx} className="space-y-2">
                        <p className="font-medium text-sm">"{obj.objection}"</p>
                        <div className="pl-4 border-l-2 border-primary">
                          <p className="text-sm text-muted-foreground italic">
                            {obj.handle}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions" className="mt-0 px-4 py-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Other Versions
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {competitor.alternateVersions?.map((version, idx) => (
                      <div key={idx} className="text-center">
                        <div className="aspect-square bg-muted rounded-xl flex items-center justify-center overflow-hidden mb-2">
                          <img
                            src={version.image}
                            alt={version.name}
                            className="w-full h-full object-contain p-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{version.name}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
};
