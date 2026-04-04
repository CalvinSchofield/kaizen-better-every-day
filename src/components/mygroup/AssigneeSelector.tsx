import { useState } from "react";
import { User, ChevronDown, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignableUser } from "@/hooks/useAssignableUsers";
import { cn } from "@/lib/utils";

interface AssigneeSelectorProps {
  assignableUsers: AssignableUser[];
  selectedAssignee: AssignableUser | null;
  onSelect: (user: AssignableUser | null) => void;
  isLoading?: boolean;
  currentUserPhotoUrl?: string | null;
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'Recruiter':
      return 'bg-primary/10 text-primary';
    case 'Team Lead':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'MGMT Group Leader':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    case 'Sr. MGMT Group Leader':
      return 'bg-violet-500/10 text-violet-700 dark:text-violet-400';
    case 'Regional':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getYearBadgeStyle = (year: string | null) => {
  switch (year) {
    case 'Rookie':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'Sophomore':
      return 'text-blue-600 dark:text-blue-400';
    case 'Vet':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-muted-foreground';
  }
};

export const AssigneeSelector = ({
  assignableUsers,
  selectedAssignee,
  onSelect,
  isLoading = false,
  currentUserPhotoUrl,
}: AssigneeSelectorProps) => {
  const [open, setOpen] = useState(false);

  if (isLoading && !assignableUsers.length) {
    return <Skeleton className="h-12 w-full rounded-lg" />;
  }

  if (assignableUsers.length === 0) {
    return (
      <Button variant="outline" className="w-full justify-start h-12" disabled>
        <User className="h-4 w-4 mr-2 text-muted-foreground" />
        <span className="text-muted-foreground">Me (default)</span>
      </Button>
    );
  }

  const selectedDisplay = selectedAssignee ? selectedAssignee : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-12 px-3"
          role="combobox"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-7 w-7 flex-shrink-0">
              {selectedDisplay?.profilePhotoUrl ? (
                <AvatarImage src={selectedDisplay.profilePhotoUrl} alt={selectedDisplay.name} />
              ) : currentUserPhotoUrl && !selectedDisplay ? (
                <AvatarImage src={currentUserPhotoUrl} alt="Me" />
              ) : null}
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                {selectedDisplay ? getInitials(selectedDisplay.name) : 'ME'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate">
                {selectedDisplay ? selectedDisplay.name : 'Me (default)'}
              </span>
              {selectedDisplay && (
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {selectedDisplay.role}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 opacity-40 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-3rem)] max-w-[340px] p-1.5" align="start">
        <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
          {/* Me option */}
          <button
            className={cn(
              "flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-colors",
              !selectedAssignee ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"
            )}
            onClick={() => { onSelect(null); setOpen(false); }}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              {currentUserPhotoUrl && <AvatarImage src={currentUserPhotoUrl} alt="Me" />}
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">ME</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground">Me (default)</span>
            </div>
            {!selectedAssignee && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </button>

          {/* Divider */}
          <div className="h-px bg-border/50 my-1" />

          {/* Assignable users */}
          {assignableUsers.map((user) => {
            const isSelected = selectedAssignee?.userId === user.userId;
            return (
              <button
                key={user.userId}
                className={cn(
                  "flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                  isSelected ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"
                )}
                onClick={() => { onSelect(user); setOpen(false); }}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {user.profilePhotoUrl && <AvatarImage src={user.profilePhotoUrl} alt={user.name} />}
                  <AvatarFallback className="text-[10px] bg-muted font-semibold text-muted-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground truncate">{user.name}</span>
                    {user.year && (
                      <span className={cn("text-[10px] font-medium", getYearBadgeStyle(user.year))}>
                        {user.year === 'Rookie' ? 'R' : user.year === 'Sophomore' ? 'S' : 'V'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none",
                      getRoleBadgeStyle(user.role)
                    )}>
                      {user.role}
                    </span>
                    {user.location && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <MapPin className="h-2.5 w-2.5" />
                        {user.location}
                        {user.sameLocation && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-0.5">✓</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
