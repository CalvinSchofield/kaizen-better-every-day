import { Target, Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface KnockingDecisionCardProps {
  isSaving?: boolean;
  onChoose: (willBeKnocking: boolean) => void;
}

export const KnockingDecisionCard = ({ isSaving = false, onChoose }: KnockingDecisionCardProps) => {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Target className="h-6 w-6" />
        </div>

        <div className="space-y-1.5">
          <CardTitle>Will you be knocking this year?</CardTitle>
          <CardDescription>
            Regional+ leaders can skip production goal setup and calendar planning if this year is leadership-only.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
          Choose <span className="font-medium text-foreground">Yes</span> to continue into goals and planning, or{' '}
          <span className="font-medium text-foreground">No</span> to skip production setup for now.
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" disabled={isSaving} onClick={() => onChoose(true)} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            Yes, I’m knocking
          </Button>

          <Button size="lg" variant="outline" disabled={isSaving} onClick={() => onChoose(false)} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            No, leadership only
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};