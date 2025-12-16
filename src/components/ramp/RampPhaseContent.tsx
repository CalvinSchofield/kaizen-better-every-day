import { Lock, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PhaseData } from "@/pages/RampToBlitz";
import type { RepData } from "@/hooks/useRepData";
import { Phase1Content } from "./Phase1Content";

interface RampPhaseContentProps {
  phase: PhaseData;
  repData: RepData | null;
}

// Placeholder task structure - will be expanded with real content
interface PhaseTask {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  requiresLeader?: boolean;
  type: 'video' | 'action' | 'quiz' | 'checklist' | 'leader-confirm';
}

export const RampPhaseContent = ({ phase, repData }: RampPhaseContentProps) => {
  if (phase.isLocked) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            Phase {phase.id} Locked
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Complete Phase {phase.id - 1} to unlock this content.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render Phase 1 with dedicated component
  if (phase.id === 1) {
    return <Phase1Content repData={repData} isComplete={phase.isComplete} />;
  }

  // Placeholder content for phases 2-4 - will be replaced with real content
  const getPhaseContent = () => {
    switch (phase.id) {
      case 2:
        return {
          title: "Start Trainings",
          description: "Learn the fundamentals of door-to-door sales",
          tasks: [
            { id: "2-1", title: "Product Basics Training", description: "Learn about our products and services", isComplete: false, type: "video" as const },
            { id: "2-2", title: "Product Knowledge Quiz", description: "Test your understanding (80% to pass)", isComplete: false, type: "quiz" as const },
            { id: "2-3", title: "Upgrades 101", description: "Master the upgrade pitch", isComplete: false, type: "video" as const },
            { id: "2-4", title: "Door Approach Training", description: "Learn and practice door approaches", isComplete: false, type: "video" as const },
            { id: "2-5", title: "Submit Pitch Video", description: "Record yourself and get feedback", isComplete: false, type: "leader-confirm" as const, requiresLeader: true },
          ],
        };
      case 3:
        return {
          title: "Practice",
          description: "Sharpen your skills before the field",
          tasks: [
            { id: "3-1", title: "iPad Setup", description: "Get your iPad ready for the field", isComplete: false, type: "checklist" as const },
            { id: "3-2", title: "Write Your Why", description: "Define your motivation and goals", isComplete: false, type: "action" as const },
            { id: "3-3", title: "1-on-1 Practice Session", description: "Practice with your leader or mentor", isComplete: false, type: "leader-confirm" as const, requiresLeader: true },
          ],
        };
      case 4:
        return {
          title: "Saddle Up!",
          description: "Final preparations for your first blitz",
          tasks: [
            { id: "4-1", title: "Watch: How to Dominate Your First Blitz", description: "Pro tips for crushing it", isComplete: false, type: "video" as const },
            { id: "4-2", title: "Packing Checklist", description: "Make sure you have everything you need", isComplete: false, type: "checklist" as const },
            { id: "4-3", title: "Equipment Check", description: "Verify all your gear is ready", isComplete: false, type: "checklist" as const },
            { id: "4-4", title: "When It Gets Tough", description: "Strategies for staying motivated", isComplete: false, type: "video" as const },
          ],
        };
      default:
        return { title: "", description: "", tasks: [] };
    }
  };

  const content = getPhaseContent();
  const completedTasks = content.tasks.filter(t => t.isComplete).length;
  const totalTasks = content.tasks.length;

  return (
    <div className="space-y-4 pb-20">
      {/* Phase Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{content.title}</h3>
          <p className="text-sm text-muted-foreground">{content.description}</p>
        </div>
        {phase.isComplete ? (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        ) : (
          <Badge variant="outline">
            {completedTasks}/{totalTasks} done
          </Badge>
        )}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {content.tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      {/* Coming Soon Notice */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            Full interactive content coming soon! Share your Notion content to build this phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

interface TaskCardProps {
  task: PhaseTask;
}

const TaskCard = ({ task }: TaskCardProps) => {
  const getTypeIcon = () => {
    switch (task.type) {
      case 'video':
        return '🎬';
      case 'quiz':
        return '📝';
      case 'checklist':
        return '✅';
      case 'leader-confirm':
        return '👤';
      default:
        return '📋';
    }
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        task.isComplete && "bg-primary/5 border-primary/20"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Completion Status */}
          <div className="mt-0.5">
            {task.isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground/50" />
            )}
          </div>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{getTypeIcon()}</span>
              <h4 className={cn(
                "font-medium text-sm",
                task.isComplete && "text-muted-foreground line-through"
              )}>
                {task.title}
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              {task.description}
            </p>
            {task.requiresLeader && (
              <Badge variant="outline" className="mt-2 text-xs">
                Requires leader verification
              </Badge>
            )}
          </div>

          {/* Action Button */}
          {!task.isComplete && (
            <Button variant="ghost" size="sm" className="shrink-0">
              Start
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
