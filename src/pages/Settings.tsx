import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Trash2, Plus, Info } from "lucide-react";
import { useRepData } from "@/hooks/useRepData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface CustomCounter {
  id: string;
  name: string;
  emoji: string;
}

export default function Settings() {
  const { repData } = useRepData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [counterName, setCounterName] = useState("");
  const [counterEmoji, setCounterEmoji] = useState("📊");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canAddCustomCounters = repData?.year === "Vet" || repData?.year === "Sophomore";
  const customCounters: CustomCounter[] = Array.isArray(repData?.custom_counter_config) 
    ? (repData.custom_counter_config as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
      }))
    : [];
  const maxCounters = 6;
  const canAddMore = customCounters.length < maxCounters;

  const handleAddCounter = async () => {
    if (!counterName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your counter",
        variant: "destructive",
      });
      return;
    }

    if (counterName.length > 20) {
      toast({
        title: "Name too long",
        description: "Counter names must be 20 characters or less",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const newCounter: CustomCounter = {
        id: crypto.randomUUID(),
        name: counterName.trim(),
        emoji: counterEmoji || "📊",
      };

      const updatedCounters = [...customCounters, newCounter];

      const { error } = await supabase
        .from("reps")
        .update({ custom_counter_config: updatedCounters as any })
        .eq("id", repData?.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });

      toast({
        title: "Counter added",
        description: `${newCounter.emoji} ${newCounter.name} has been added to your Track page`,
      });

      setCounterName("");
      setCounterEmoji("📊");
      setShowAddSheet(false);
    } catch (error: any) {
      console.error("Error adding counter:", error);
      toast({
        title: "Failed to add counter",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCounter = async (counterId: string) => {
    setIsDeleting(counterId);

    try {
      const updatedCounters = customCounters.filter((c) => c.id !== counterId);

      const { error } = await supabase
        .from("reps")
        .update({ custom_counter_config: updatedCounters as any })
        .eq("id", repData?.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['rep-data'] });

      toast({
        title: "Counter deleted",
        description: "The counter and its historical data have been removed",
      });
    } catch (error: any) {
      console.error("Error deleting counter:", error);
      toast({
        title: "Failed to delete counter",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const commonEmojis = ["📊", "📈", "📞", "🎯", "✅", "💰", "📝", "🔥", "⭐", "💪"];

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account preferences</p>
        </div>

        {canAddCustomCounters ? (
          <Card>
            <CardHeader>
              <CardTitle>Custom Counters</CardTitle>
              <CardDescription>
                Track additional metrics beyond the core 6 counters. Custom counters appear on your Track page and in your personal Insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customCounters.length > 0 ? (
                <div className="space-y-2">
                  {customCounters.map((counter) => (
                    <div
                      key={counter.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{counter.emoji}</span>
                        <span className="font-medium">{counter.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCounter(counter.id)}
                        disabled={isDeleting === counter.id}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No custom counters yet</p>
                  <p className="text-sm mt-1">Add counters to track additional metrics</p>
                </div>
              )}

              {canAddMore ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddSheet(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Counter ({customCounters.length}/{maxCounters})
                </Button>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                  <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    You've reached the maximum of {maxCounters} custom counters. Delete one to add a new counter.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Note:</strong> Deleting a counter will remove all its historical data. This cannot be undone.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Custom Counters</CardTitle>
              <CardDescription>
                Available for Vets and Sophomores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Custom counters allow experienced reps to track additional metrics beyond the core 6 inputs. This feature will be available once you complete your rookie season.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Counter Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Add Custom Counter</SheetTitle>
            <SheetDescription>
              Create a new counter to track on your QTally page
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            <div>
              <Label htmlFor="counter-name">Counter Name</Label>
              <Input
                id="counter-name"
                placeholder="e.g., Referrals"
                value={counterName}
                onChange={(e) => setCounterName(e.target.value)}
                maxLength={20}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {counterName.length}/20 characters
              </p>
            </div>

            <div>
              <Label>Emoji (Optional)</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setCounterEmoji(emoji)}
                    className={`p-3 text-2xl border rounded-lg transition-colors ${
                      counterEmoji === emoji
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {counterEmoji}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddSheet(false);
                  setCounterName("");
                  setCounterEmoji("📊");
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddCounter}
                disabled={!counterName.trim() || isSaving}
              >
                {isSaving ? "Adding..." : "Add Counter"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
