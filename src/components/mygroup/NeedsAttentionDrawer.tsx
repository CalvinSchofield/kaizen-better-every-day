import { useState } from "react";
import { Phone, MessageSquare, ChevronRight, CheckCircle2, Circle, Tablet, BookOpen, MessageCircle, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { AttentionCategory, AttentionRecruit } from "@/hooks/useNeedsAttention";
import { Recruit, useLogRecruitActivity } from "@/hooks/useGroupRecruits";
import { useUpdateRookieStatus } from "@/hooks/useUpdateRookieStatus";
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

// Training progress item component
const TrainingProgressItem = ({ 
  item,
  onRecruitClick,
  onOpenChange
}: { 
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const updateStatusMutation = useUpdateRookieStatus();
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  const progress = item.trainingProgress;
  if (!progress) return null;

  const handleToggle = async (field: string, currentValue: boolean) => {
    setUpdatingField(field);
    
    try {
      if (field === 'ipadAssigned') {
        await updateStatusMutation.mutateAsync({
          rookieNotionPageId: item.recruit.notionPageId,
          ipadAssigned: !currentValue,
        });
        toast.success(`iPad ${!currentValue ? 'assigned' : 'unassigned'}`);
      }
    } finally {
      setUpdatingField(null);
    }
  };

  const progressItems = [
    { 
      key: 'onboardingComplete', 
      label: 'Onboarding', 
      value: progress.onboardingComplete,
      icon: GraduationCap,
      editable: false
    },
    { 
      key: 'trainingsComplete', 
      label: 'Trainings', 
      value: progress.trainingsComplete,
      icon: BookOpen,
      editable: false
    },
    { 
      key: 'slackJoined', 
      label: 'Slack', 
      value: progress.slackJoined,
      icon: MessageCircle,
      editable: false
    },
    { 
      key: 'ipadAssigned', 
      label: 'iPad', 
      value: progress.ipadAssigned,
      icon: Tablet,
      editable: true
    },
  ];

  return (
    <div
      className={cn(
        "bg-card rounded-lg p-4 border border-l-4 shadow-sm",
        URGENCY_STYLES[item.urgency]
      )}
    >
      {/* Header - clickable to open detail */}
      <div 
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => {
          onRecruitClick(item.recruit);
          onOpenChange(false);
        }}
      >
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
            {item.onboardingStatus || 'Not started'}
          </p>
          {item.daysUntilBlitz && (
            <Badge variant="secondary" className="mt-1 text-xs">
              Blitz in {item.daysUntilBlitz}d
            </Badge>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
      </div>

      {/* Progress checklist */}
      <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
        {progressItems.map(({ key, label, value, icon: Icon, editable }) => (
          <div 
            key={key}
            className={cn(
              "flex items-center justify-between p-2 rounded-lg",
              value ? "bg-green-500/10" : "bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              {value ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn(
                "text-sm",
                value ? "text-green-600" : "text-muted-foreground"
              )}>
                {label}
              </span>
            </div>
            {editable && (
              updatingField === key ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={value}
                  onCheckedChange={() => handleToggle(key, value)}
                  className="scale-75"
                />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Default recruit item component
const DefaultRecruitItem = ({
  item,
  onRecruitClick,
  onOpenChange,
  onCall,
  onText
}: {
  item: AttentionRecruit;
  onRecruitClick: (recruit: Recruit) => void;
  onOpenChange: (open: boolean) => void;
  onCall: (recruit: Recruit, e: React.MouseEvent) => void;
  onText: (recruit: Recruit, e: React.MouseEvent) => void;
}) => (
  <div
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
              onClick={(e) => onCall(item.recruit, e)}
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={(e) => onText(item.recruit, e)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground mt-2.5" />
      </div>
    </div>
  </div>
);

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

  const isTrainingCategory = category.id === 'training-progress';

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
            isTrainingCategory ? (
              <TrainingProgressItem
                key={item.recruit.notionPageId}
                item={item}
                onRecruitClick={onRecruitClick}
                onOpenChange={onOpenChange}
              />
            ) : (
              <DefaultRecruitItem
                key={item.recruit.notionPageId}
                item={item}
                onRecruitClick={onRecruitClick}
                onOpenChange={onOpenChange}
                onCall={handleCall}
                onText={handleText}
              />
            )
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
