import { Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactForHelp } from "./types";

interface QuickActionsBarProps {
  onCall: () => void;
  onText: () => void;
  onAskForHelp: () => void;
  contactForHelp: ContactForHelp | null;
  isLoading?: boolean;
}

export const QuickActionsBar = ({
  onCall,
  onText,
  onAskForHelp,
  contactForHelp,
  isLoading
}: QuickActionsBarProps) => {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-3 -mx-4 px-4 pt-2">
      <div className="flex gap-2">
        <Button 
          className="flex-1 h-11" 
          onClick={onCall}
        >
          <Phone className="h-4 w-4 mr-2" />
          Call
        </Button>
        <Button 
          variant="outline" 
          className="flex-1 h-11" 
          onClick={onText}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Text
        </Button>
        {contactForHelp && (
          <Button 
            variant="outline" 
            className="flex-1 h-11 text-xs px-2"
            onClick={onAskForHelp}
            disabled={isLoading}
          >
            <MessageSquare className="h-4 w-4 mr-1 shrink-0" />
            <span className="truncate">Text {contactForHelp.name}</span>
          </Button>
        )}
      </div>
    </div>
  );
};
