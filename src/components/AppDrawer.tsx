import { Link } from "react-router-dom";
import { MessageSquare, Calendar, Settings, Lock, BarChart3, BookOpen, Wrench } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppMode } from "@/hooks/useAppMode";
import { useRepData } from "@/hooks/useRepData";
import { useState } from "react";

interface AppDrawerProps {
  trigger: React.ReactNode;
  firstName?: string;
}

export const AppDrawer = ({ trigger, firstName }: AppDrawerProps) => {
  const { repData } = useRepData();
  const { isKnockingMode, toggleMode, isToggling, canAccessKnockingToggle } = useAppMode(repData);
  const [open, setOpen] = useState(false);

  // Check if user is a pre-blitz rookie
  const year = repData?.year || "Rookie";
  const isRookie = year === "Rookie";
  const isVetOrSoph = year === "Vet" || year === "Sophomore";
  
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  const hasAttendedBlitz = blitzes.some((blitz: any) => {
    if (blitz.endDate) {
      const endDate = new Date(blitz.endDate);
      return endDate < new Date();
    }
    return false;
  });

  const isCalendarLocked = isRookie && !hasAttendedBlitz;

  // Strip emojis from firstName
  const cleanFirstName = firstName?.replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu, '').trim();

  const handleToggle = (checked: boolean) => {
    toggleMode(checked);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px]">
        <SheetHeader>
          <SheetTitle>
            {cleanFirstName ? `Hey, ${cleanFirstName}` : "Menu"}
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col gap-4 p-4">
          {/* Knocking Mode Toggle - Only show if user has access */}
          {canAccessKnockingToggle && (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg bg-card">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="knocking-mode" className="text-base font-semibold cursor-pointer">
                    🚪 Knocking Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {isKnockingMode ? "Active" : "Preseason"}
                  </p>
                </div>
                <Switch
                  id="knocking-mode"
                  checked={isKnockingMode}
                  onCheckedChange={handleToggle}
                  disabled={isToggling}
                />
              </div>
              <Separator />
            </>
          )}

          {/* Training Link - Show in drawer when knocking mode is ON */}
          {isKnockingMode && (
            <Link
              to="/training"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <BookOpen className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold">Training</span>
                <span className="text-sm text-muted-foreground">
                  Access training resources
                </span>
              </div>
            </Link>
          )}

          {/* Tools Link - Show in drawer for vets when knocking mode is ON */}
          {isKnockingMode && isVetOrSoph && (
            <Link
              to="/tools"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
            >
              <Wrench className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold">Tools</span>
                <span className="text-sm text-muted-foreground">
                  Access sales tools
                </span>
              </div>
            </Link>
          )}

          {(isKnockingMode && (canAccessKnockingToggle || isVetOrSoph)) && <Separator />}

          {/* Calendar Link */}
          <Link
            to="/calendar"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
          >
            <div className="relative">
              <Calendar className="w-5 h-5 text-primary" />
              {isCalendarLocked && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
                  <Lock className="w-3 h-3 text-primary" />
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold">Calendar</span>
              <span className="text-sm text-muted-foreground">
                {isCalendarLocked ? "Unlocks on your first blitz" : "View and manage entries"}
              </span>
            </div>
          </Link>

          {/* Insights Link */}
          <Link
            to="/insights"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
          >
            <div className="relative">
              <BarChart3 className="w-5 h-5 text-primary" />
              {isCalendarLocked && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full">
                  <Lock className="w-3 h-3 text-primary" />
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold">Insights</span>
              <span className="text-sm text-muted-foreground">
                {isCalendarLocked ? "Unlocks on your first blitz" : "Track your performance"}
              </span>
            </div>
          </Link>

          <Separator />

          {/* AI Assistant Link */}
          <a
            href="https://chatgpt.com/g/g-676a50c52d988191bdc2edf913ffbe90-vivint-gpt"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-primary" />
            <div className="flex flex-col">
              <span className="font-semibold">AI Assistant</span>
              <span className="text-sm text-muted-foreground">
                {isKnockingMode
                  ? "Help with sales & objections"
                  : "Help with onboarding & training"}
              </span>
            </div>
          </a>

          <Separator />

          {/* Settings (placeholder) */}
          <div className="flex items-center gap-3 p-4 rounded-lg opacity-50 cursor-not-allowed">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-semibold">Settings</span>
              <span className="text-sm text-muted-foreground">
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};