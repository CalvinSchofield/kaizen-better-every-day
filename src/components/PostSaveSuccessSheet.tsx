import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PostSaveSuccessSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: {
    doors: number;
    presentations: number;
    closes: number;
    fpPlus: number;
    prmr: number;
  };
  onKeepWorking: () => void;
}

export const PostSaveSuccessSheet = ({ 
  open, 
  onOpenChange, 
  summary,
  onKeepWorking,
}: PostSaveSuccessSheetProps) => {
  const navigate = useNavigate();
  
  const handleDone = () => {
    onOpenChange(false);
  };

  const handleViewCalendar = () => {
    onOpenChange(false);
    navigate('/calendar');
  };

  const handleViewInsights = () => {
    onOpenChange(false);
    navigate('/insights');
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader className="mb-2">
          <div className="flex items-center gap-2 justify-center mb-2">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <DrawerTitle>Great work today!</DrawerTitle>
          <DrawerDescription>
            Your entry has been saved successfully.
          </DrawerDescription>
        </DrawerHeader>
        
        {/* Summary Stats */}
        <div className="px-4 mb-6">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Doors Knocked</span>
              <span className="font-medium">{summary.doors}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Presentations</span>
              <span className="font-medium">{summary.presentations}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Closes</span>
              <span className="font-medium">{summary.closes}</span>
            </div>
            {summary.fpPlus > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                <span className="text-muted-foreground">FP+</span>
                <span className="font-semibold text-primary">{summary.fpPlus}</span>
              </div>
            )}
            {summary.prmr > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PRMR</span>
                <span className="font-semibold text-green-600">${Math.round(summary.prmr)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info about data */}
        <div className="px-4 text-sm text-muted-foreground mb-6 text-center">
          Your data is now available in Calendar, Insights, and Reports.
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-3 px-4 mb-4">
          <Button
            onClick={handleViewCalendar}
            variant="outline"
            className="flex-1 py-4"
            size="sm"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Calendar
          </Button>
          <Button
            onClick={handleViewInsights}
            variant="outline"
            className="flex-1 py-4"
            size="sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Insights
          </Button>
        </div>

        <div className="flex flex-col gap-3 px-4">
          <Button
            onClick={handleDone}
            variant="default"
            className="w-full py-6 text-lg font-semibold"
            size="lg"
          >
            Done for Today
          </Button>
          <Button
            onClick={() => {
              onKeepWorking();
              onOpenChange(false);
            }}
            variant="ghost"
            className="w-full py-4 text-sm"
          >
            Actually, I need to keep working
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
