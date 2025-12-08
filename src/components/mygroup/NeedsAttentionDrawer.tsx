import { Phone, MessageSquare, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { AttentionCategory } from "@/hooks/useNeedsAttention";
import { Recruit, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NeedsAttentionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: AttentionCategory | null;
  onRecruitClick: (recruit: Recruit) => void;
}

// Strip emojis from name
const stripEmojis = (text: string | null): string | null => {
  if (!text) return null;
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim();
};

const URGENCY_STYLES = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-green-500',
};

export const NeedsAttentionDrawer = ({ 
  open, 
  onOpenChange, 
  category,
  onRecruitClick 
}: NeedsAttentionDrawerProps) => {
  const logActivityMutation = useLogRecruitActivity();

  if (!category) return null;

  const handleCall = async (recruit: Recruit, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await logActivityMutation.mutateAsync({
        recruitNotionId: recruit.notionPageId,
        activityType: 'phone_call',
        notes: 'Call attempt',
        updateLastContact: true,
      });
      toast.success('Call logged');
    } catch (error) {
      console.error('Failed to log call:', error);
    }
    window.location.href = `tel:${recruit.phone}`;
  };

  const handleText = async (recruit: Recruit, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${recruit.phone}`;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <span>{category.emoji}</span>
              <span>{category.label}</span>
              <Badge variant="secondary" className="ml-2">
                {category.count}
              </Badge>
            </DrawerTitle>
          </div>
        </DrawerHeader>
        
        <div className="overflow-y-auto p-4 space-y-3">
          {category.recruits.map((item) => (
            <div
              key={item.recruit.notionPageId}
              className={cn(
                "bg-card rounded-lg p-4 border border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all",
                URGENCY_STYLES[item.urgency]
              )}
              onClick={() => {
                onRecruitClick(item.recruit);
                onOpenChange(false);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium">
                      {stripEmojis(item.recruit.name)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {item.recruit.stage}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.reason}
                  </p>
                  {item.recruit.teamName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.recruit.teamName}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-1 flex-shrink-0">
                  {item.recruit.phone && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={(e) => handleCall(item.recruit, e)}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={(e) => handleText(item.recruit, e)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-2.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
