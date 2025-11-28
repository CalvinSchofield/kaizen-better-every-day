import { Link } from "react-router-dom";
import { MessageSquare, Calendar, Settings } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppMode } from "@/hooks/useAppMode";
import { useState } from "react";

interface AppDrawerProps {
  trigger: React.ReactNode;
  firstName?: string;
}

export const AppDrawer = ({ trigger, firstName }: AppDrawerProps) => {
  const { isKnockingMode, toggleMode, isToggling } = useAppMode();
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    toggleMode(!isKnockingMode);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>
            {firstName ? `Hey, ${firstName}` : "Menu"}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="flex flex-col gap-4 p-4">
          {/* Knocking Mode Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-card">
            <div className="flex flex-col gap-1">
              <Label htmlFor="knocking-mode" className="text-base font-semibold">
                🌙 Knocking Mode
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

          {/* Calendar Link */}
          <Link
            to="/calendar"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors"
          >
            <Calendar className="w-5 h-5 text-primary" />
            <div className="flex flex-col">
              <span className="font-semibold">Calendar</span>
              <span className="text-sm text-muted-foreground">
                View and manage entries
              </span>
            </div>
          </Link>

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
      </DrawerContent>
    </Drawer>
  );
};