import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Competitor } from "@/hooks/useCompetitors";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface CompetitorDetailSheetProps {
  competitor: Competitor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CompetitorDetailSheet = ({
  competitor,
  open,
  onOpenChange,
}: CompetitorDetailSheetProps) => {
  if (!competitor) return null;
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh] overflow-y-auto rounded-t-3xl">
        <div className="max-w-2xl mx-auto pb-8">
          {/* Product Image */}
          <div className="flex justify-center mb-6">
            {competitor.main_image_url ? (
              <img
                src={competitor.main_image_url}
                alt={competitor.name}
                className="w-40 h-40 object-contain"
              />
            ) : (
              <div className="w-40 h-40 bg-muted rounded-xl flex items-center justify-center">
                <span className="text-5xl">📷</span>
              </div>
            )}
          </div>

          {/* Product Name & Category */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">{competitor.name}</h2>
            {competitor.category && (
              <Badge variant="secondary" className="text-sm">
                {competitor.category}
              </Badge>
            )}
          </div>

          {/* Collapsible Sections */}
          <Accordion type="single" collapsible defaultValue="why-bought" className="space-y-3">
            {/* Why They Bought */}
            {competitor.their_selling_points.length > 0 && (
              <AccordionItem value="why-bought" className="border border-border rounded-xl px-4">
                <AccordionTrigger className="text-left font-semibold">
                  Why They Bought It
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-muted-foreground">
                    {competitor.their_selling_points.map((point, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span>•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Monitoring Companies */}
            {competitor.monitoring_companies.length > 0 && (
              <AccordionItem value="monitoring" className="border border-border rounded-xl px-4">
                <AccordionTrigger className="text-left font-semibold">
                  Monitoring Companies
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-2">
                    {competitor.monitoring_companies.map((company, idx) => (
                      <Badge key={idx} variant="outline">
                        {company}
                      </Badge>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Objections */}
            {competitor.objections.length > 0 && (
              <AccordionItem value="objections" className="border border-border rounded-xl px-4">
                <AccordionTrigger className="text-left font-semibold">
                  Common Objections
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {competitor.objections.map((obj, idx) => (
                      <div key={idx} className="space-y-2">
                        <p className="font-medium text-sm">{obj.objection}</p>
                        <div className="pl-4 border-l-2 border-accent">
                          <p className="text-muted-foreground text-sm italic">
                            {obj.handle}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Alternate Versions */}
            {competitor.alternate_versions.length > 0 && (
              <AccordionItem value="versions" className="border border-border rounded-xl px-4">
                <AccordionTrigger className="text-left font-semibold">
                  Other Versions
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-3 gap-4">
                    {competitor.alternate_versions.map((version, idx) => (
                      <div key={idx} className="text-center">
                        {version.image_url ? (
                          <img
                            src={version.image_url}
                            alt={version.name}
                            className="w-16 h-16 object-contain mx-auto mb-2"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded-lg mx-auto mb-2 flex items-center justify-center">
                            <span className="text-xl">📷</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2">{version.name}</p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
};
