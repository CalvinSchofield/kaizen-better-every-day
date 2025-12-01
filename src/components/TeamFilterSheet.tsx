import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEffect, useState } from "react";

interface TeamFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessData: any;
  selectedUserIds: string[];
  onUserIdsChange: (ids: string[]) => void;
  excludeUserIds: string[];
  onExcludeUserIdsChange: (ids: string[]) => void;
  viewMode: 'totals' | 'individual';
  onViewModeChange: (mode: 'totals' | 'individual') => void;
}

export const TeamFilterSheet = ({
  open,
  onOpenChange,
  accessData,
  selectedUserIds,
  onUserIdsChange,
  excludeUserIds,
  onExcludeUserIdsChange,
  viewMode,
  onViewModeChange,
}: TeamFilterSheetProps) => {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedUserIds);
  const [localExcluded, setLocalExcluded] = useState<string[]>(excludeUserIds);

  useEffect(() => {
    setLocalSelected(selectedUserIds);
    setLocalExcluded(excludeUserIds);
  }, [selectedUserIds, excludeUserIds]);

  const handleApply = () => {
    onUserIdsChange(localSelected);
    onExcludeUserIdsChange(localExcluded);
    
    // Save to localStorage
    localStorage.setItem('team-reports-filter', JSON.stringify({
      selectedUserIds: localSelected,
      excludeUserIds: localExcluded,
      viewMode,
    }));
    
    onOpenChange(false);
  };

  const handleSelectAll = () => {
    setLocalSelected(accessData?.accessibleUserIds || []);
    setLocalExcluded([]);
  };

  const handleDeselectAll = () => {
    setLocalSelected([]);
  };

  const toggleRep = (userId: string) => {
    if (localSelected.includes(userId)) {
      setLocalSelected(localSelected.filter(id => id !== userId));
    } else {
      setLocalSelected([...localSelected, userId]);
      setLocalExcluded(localExcluded.filter(id => id !== userId));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Filter Team Members</SheetTitle>
          <SheetDescription>
            Select which team members to include in the report
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* View Mode Toggle */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">View Mode</Label>
            <RadioGroup value={viewMode} onValueChange={(v) => onViewModeChange(v as 'totals' | 'individual')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="totals" id="totals" />
                <Label htmlFor="totals" className="font-normal cursor-pointer">
                  View Totals
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual" className="font-normal cursor-pointer">
                  View Individual Breakdown
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>

          {/* Team Members List */}
          <div className="space-y-3 max-h-[40vh] overflow-y-auto">
            <Label className="text-base font-semibold">Team Members</Label>
            {accessData?.accessibleReps?.map((rep: any) => (
              <div key={rep.userId} className="flex items-center space-x-2">
                <Checkbox
                  id={rep.userId}
                  checked={localSelected.includes(rep.userId)}
                  onCheckedChange={() => toggleRep(rep.userId)}
                />
                <Label htmlFor={rep.userId} className="font-normal cursor-pointer flex-1">
                  {rep.name}
                </Label>
              </div>
            ))}
          </div>

          {/* Apply Button */}
          <Button onClick={handleApply} className="w-full">
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
