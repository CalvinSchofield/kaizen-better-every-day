import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Check, X, Info, Zap, Target, Link2, Scale, ChevronDown, ChevronUp, DollarSign, FileImage, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ProductData } from "./productKnowledgeData";

interface ProductGuideProps {
  product: ProductData;
  onBack: () => void;
}

export const ProductGuide = ({ product, onBack }: ProductGuideProps) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedSections, setExpandedSections] = useState<string[]>(["tier1"]);
  const [currentUseCase, setCurrentUseCase] = useState(0);

  // Embla carousel for use cases
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentUseCase(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

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
            <h1 className="font-semibold text-lg truncate">{product.name}</h1>
            <p className="text-sm text-muted-foreground truncate">{product.tagline}</p>
          </div>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center overflow-hidden">
        <img 
          src={product.heroImage} 
          alt={product.name}
          className="w-full h-full object-contain p-4"
        />
        {product.pricing?.upfront && (
          <div className="absolute bottom-3 right-3">
            <Badge className="bg-background/95 backdrop-blur-sm shadow-lg text-foreground border-0 px-3 py-1.5 text-sm font-semibold">
              {product.pricing.upfront}
            </Badge>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[57px] z-10 bg-background border-b px-4">
          <TabsList className="w-full grid grid-cols-4 h-12">
            <TabsTrigger value="overview" className="text-xs px-1">Overview</TabsTrigger>
            <TabsTrigger value="details" className="text-xs px-1">Details</TabsTrigger>
            <TabsTrigger value="compare" className="text-xs px-1" disabled={!product.competitorComparison}>
              Compare
            </TabsTrigger>
            <TabsTrigger value="quickref" className="text-xs px-1" disabled={!product.onePagerImage}>
              Quick Ref
            </TabsTrigger>
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0 px-4 py-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Description */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
                </CardContent>
              </Card>

              {/* Pricing */}
              {product.pricing && (product.pricing.upfront || product.pricing.months60) && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-accent" />
                      Pricing
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {product.pricing.upfront && (
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Upfront</p>
                          <p className="font-semibold text-sm">{product.pricing.upfront}</p>
                        </div>
                      )}
                      {product.pricing.months60 && (
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                          <p className="font-semibold text-sm">{product.pricing.months60}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">60-month financing</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tier 1 Messaging */}
              <Collapsible open={expandedSections.includes("tier1")} onOpenChange={() => toggleSection("tier1")}>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-sm">Tier 1 Messaging</h3>
                          <p className="text-xs text-muted-foreground">Top selling points</p>
                        </div>
                      </div>
                      {expandedSections.includes("tier1") ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4">
                      <ul className="space-y-2">
                        {product.tier1Messaging.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Tier 2 Messaging */}
              <Collapsible open={expandedSections.includes("tier2")} onOpenChange={() => toggleSection("tier2")}>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center">
                          <Info className="h-4 w-4 text-secondary-foreground" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-sm">Tier 2 Messaging</h3>
                          <p className="text-xs text-muted-foreground">Additional features</p>
                        </div>
                      </div>
                      {expandedSections.includes("tier2") ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4">
                      <ul className="space-y-2">
                        {product.tier2Messaging.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Benefits */}
              <Collapsible open={expandedSections.includes("benefits")} onOpenChange={() => toggleSection("benefits")}>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                          <Target className="h-4 w-4 text-accent" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-sm">Customer Benefits</h3>
                          <p className="text-xs text-muted-foreground">Why they'll love it</p>
                        </div>
                      </div>
                      {expandedSections.includes("benefits") ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4">
                      <ul className="space-y-2">
                        {product.benefits.map((benefit, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </motion.div>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-0 px-4 py-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Use Cases Carousel */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Use Cases
                  </h3>
                  <div className="overflow-hidden" ref={emblaRef}>
                    <div className="flex">
                      {product.useCases.map((useCase, idx) => (
                        <div key={idx} className="flex-[0_0_100%] min-w-0">
                          <div className="bg-muted/50 rounded-lg p-4">
                            <h4 className="font-medium text-sm mb-2">{useCase.title}</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {useCase.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Dots */}
                  <div className="flex justify-center gap-2 mt-3">
                    {product.useCases.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => scrollTo(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentUseCase ? "bg-primary w-4" : "bg-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* What's New */}
              {product.whatsNew && product.whatsNew.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-accent" />
                      What's New
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {product.whatsNew.map((item, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Integration System */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    Integration System
                  </h3>
                  <ul className="space-y-2">
                    {product.integrationFeatures.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Compare Tab */}
          <TabsContent value="compare" className="mt-0 px-4 py-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {product.competitorComparison && product.competitorNames && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-primary" />
                      Feature Comparison
                    </h3>
                    <div className="overflow-x-auto -mx-4 px-4">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 pr-2 font-medium">Feature</th>
                            <th className="text-center py-2 px-1 font-medium text-primary">Vivint</th>
                            {product.competitorNames.map((name, idx) => (
                              <th key={idx} className="text-center py-2 px-1 font-medium text-muted-foreground">
                                {name.split(" ")[0]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {product.competitorComparison.map((row, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="py-2 pr-2 text-muted-foreground">{row.feature}</td>
                              <td className="text-center py-2 px-1">
                                {row.vivint === true ? (
                                  <Check className="h-4 w-4 text-success mx-auto" />
                                ) : row.vivint === false ? (
                                  <X className="h-4 w-4 text-destructive mx-auto" />
                                ) : (
                                  <span className="text-warning">{row.vivint}</span>
                                )}
                              </td>
                              {product.competitorNames!.map((name, cIdx) => {
                                const value = row.competitors[name];
                                return (
                                  <td key={cIdx} className="text-center py-2 px-1">
                                    {value === true ? (
                                      <Check className="h-4 w-4 text-muted-foreground mx-auto" />
                                    ) : value === false ? (
                                      <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                                    ) : (
                                      <span className="text-warning text-[10px]">{value}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!product.competitorComparison && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Scale className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No competitor comparison available for this product.
                    </p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Quick Ref Tab */}
          <TabsContent value="quickref" className="mt-0 px-4 py-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {product.onePagerImage ? (
                <>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-2">
                    <ZoomIn className="h-3.5 w-3.5" />
                    <span>Pinch or double-tap to zoom</span>
                  </div>
                  <Card className="overflow-hidden">
                    <CardContent className="p-0">
                      <TransformWrapper
                        initialScale={1}
                        minScale={1}
                        maxScale={4}
                        doubleClick={{ mode: "toggle", step: 2 }}
                        pinch={{ step: 5 }}
                      >
                        <TransformComponent
                          wrapperStyle={{ width: "100%" }}
                          contentStyle={{ width: "100%" }}
                        >
                          <img 
                            src={product.onePagerImage} 
                            alt={`${product.name} Quick Reference`}
                            className="w-full h-auto"
                          />
                        </TransformComponent>
                      </TransformWrapper>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileImage className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No quick reference available for this product yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
};
