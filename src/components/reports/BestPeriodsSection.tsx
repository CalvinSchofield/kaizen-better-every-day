import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, User, Trophy, Clock, Target, TrendingUp, Calendar, ChevronDown } from "lucide-react";
import { DayOfWeekBestPeriods } from "./DayOfWeekBestPeriods";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface GroupRecord {
  date: string;
  value: number;
  repsWorked: number;
}

interface TimingRecord {
  date: string;
  value: string;
  repsWorked: number;
}

interface DurationRecord {
  date: string;
  avgMinutes: number;
  repsWorked: number;
}

interface IndividualRecord {
  date: string;
  value: number;
  repName: string;
  isRookie: boolean;
}

interface BestPeriodsData {
  // Group records
  highestFpDay: GroupRecord | null;
  highestPrmrDay: GroupRecord | null;
  mostPresentationsPerRepDay: GroupRecord | null;
  mostTransitionsPerRepDay: GroupRecord | null;
  mostPitchesPerRepDay: GroupRecord | null;
  mostDMsPerRepDay: GroupRecord | null;
  mostDoorsPerRepDay: GroupRecord | null;
  earliestStartDay: TimingRecord | null;
  latestEndDay: TimingRecord | null;
  longestDurationDay: DurationRecord | null;
  
  // Individual records
  individualBestFp: IndividualRecord | null;
  individualBestPrmr: IndividualRecord | null;
  individualBestPresentations: IndividualRecord | null;
  individualBestTransitions: IndividualRecord | null;
  individualBestPitches: IndividualRecord | null;
  individualBestDMs: IndividualRecord | null;
  individualBestDoors: IndividualRecord | null;
  
  // Rookie-specific best records
  rookieBestFp?: IndividualRecord | null;
  rookieBestPrmr?: IndividualRecord | null;
  rookieBestPresentations?: IndividualRecord | null;
  rookieBestTransitions?: IndividualRecord | null;
  rookieBestPitches?: IndividualRecord | null;
  rookieBestDMs?: IndividualRecord | null;
  rookieBestDoors?: IndividualRecord | null;
}

interface DailyTrendItem {
  date: string;
  fp: number;
  prmr: number;
  doors: number;
  dms?: number;
  pitches?: number;
  transitions?: number;
  presentations?: number;
  closes?: number;
  repsWorked?: number;
}

interface BestPeriodsSectionProps {
  data: BestPeriodsData | null;
  dailyTrend?: DailyTrendItem[];
}

type ViewMode = 'group' | 'individual';
type RookieFilter = 'all' | 'rookie';

export const BestPeriodsSection = ({ data, dailyTrend }: BestPeriodsSectionProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('group');
  const [rookieFilter, setRookieFilter] = useState<RookieFilter>('all');
  const [isOpen, setIsOpen] = useState(false);

  if (!data) return null;

  const formatAvgValue = (value: number, decimals: number = 1) => {
    return value.toFixed(decimals);
  };

  const stripEmojis = (text: string) => {
    return text.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}]/gu, '').trim();
  };

  // Get the appropriate record based on rookie filter
  // When 'rookie' filter is active, use the dedicated rookie records from the data
  const getIndividualRecord = (allRecord: IndividualRecord | null, rookieRecord?: IndividualRecord | null): IndividualRecord | null => {
    if (rookieFilter === 'all') return allRecord;
    // Use the pre-calculated rookie-specific record
    return rookieRecord || null;
  };

  // Build collapsed summary
  const getCollapsedSummary = () => {
    const highlights: string[] = [];
    if (data.highestFpDay) highlights.push(`${formatAvgValue(data.highestFpDay.value)} FP+`);
    if (data.highestPrmrDay) highlights.push(`$${formatAvgValue(data.highestPrmrDay.value, 0)} PRMR`);
    if (data.individualBestFp) highlights.push(stripEmojis(data.individualBestFp.repName));
    return highlights.slice(0, 3).join(' · ') || 'View records';
  };

  const renderGroupRecords = () => (
    <div className="space-y-3">
      {/* Output Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {data.highestFpDay && (
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Highest FP+ Day</span>
            </div>
            <div className="text-lg font-bold text-primary">{formatAvgValue(data.highestFpDay.value)} FP+</div>
            <div className="text-xs text-muted-foreground">{data.highestFpDay.date}</div>
            <div className="text-xs text-muted-foreground/70">{data.highestFpDay.repsWorked} reps worked</div>
          </Card>
        )}

        {data.highestPrmrDay && (
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-medium text-muted-foreground">Highest PRMR Day</span>
            </div>
            <div className="text-lg font-bold text-green-600">${formatAvgValue(data.highestPrmrDay.value, 0)}</div>
            <div className="text-xs text-muted-foreground">{data.highestPrmrDay.date}</div>
            <div className="text-xs text-muted-foreground/70">{data.highestPrmrDay.repsWorked} reps worked</div>
          </Card>
        )}
      </div>

      {/* Activity Per Rep Metrics */}
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">
        Best Activity Per Rep Worked
      </div>
      <div className="grid grid-cols-2 gap-3">
        {data.mostPresentationsPerRepDay && (
          <Card className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">Most Pres/Rep</div>
            <div className="text-lg font-bold">{formatAvgValue(data.mostPresentationsPerRepDay.value)}</div>
            <div className="text-xs text-muted-foreground">{data.mostPresentationsPerRepDay.date}</div>
          </Card>
        )}

        {data.mostTransitionsPerRepDay && (
          <Card className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">Most Trans/Rep</div>
            <div className="text-lg font-bold">{formatAvgValue(data.mostTransitionsPerRepDay.value)}</div>
            <div className="text-xs text-muted-foreground">{data.mostTransitionsPerRepDay.date}</div>
          </Card>
        )}

        {data.mostPitchesPerRepDay && (
          <Card className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">Most Pitches/Rep</div>
            <div className="text-lg font-bold">{formatAvgValue(data.mostPitchesPerRepDay.value)}</div>
            <div className="text-xs text-muted-foreground">{data.mostPitchesPerRepDay.date}</div>
          </Card>
        )}

        {data.mostDMsPerRepDay && (
          <Card className="p-3">
            <div className="text-xs font-medium text-muted-foreground mb-1">Most DMs/Rep</div>
            <div className="text-lg font-bold">{formatAvgValue(data.mostDMsPerRepDay.value)}</div>
            <div className="text-xs text-muted-foreground">{data.mostDMsPerRepDay.date}</div>
          </Card>
        )}

        {data.mostDoorsPerRepDay && (
          <Card className="p-3 col-span-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">Most Doors/Rep</div>
            <div className="text-lg font-bold">{formatAvgValue(data.mostDoorsPerRepDay.value)}</div>
            <div className="text-xs text-muted-foreground">{data.mostDoorsPerRepDay.date}</div>
          </Card>
        )}
      </div>

      {/* Timing Metrics */}
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">
        Best Timing Days
      </div>
      <div className="grid grid-cols-1 gap-3">
        {data.earliestStartDay && (
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Earliest Avg Start</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{data.earliestStartDay.value}</div>
                <div className="text-xs text-muted-foreground">{data.earliestStartDay.date}</div>
              </div>
              <div className="text-xs text-muted-foreground/70">{data.earliestStartDay.repsWorked} reps</div>
            </div>
          </Card>
        )}

        {data.latestEndDay && (
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">Latest Avg End</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{data.latestEndDay.value}</div>
                <div className="text-xs text-muted-foreground">{data.latestEndDay.date}</div>
              </div>
              <div className="text-xs text-muted-foreground/70">{data.latestEndDay.repsWorked} reps</div>
            </div>
          </Card>
        )}

        {data.longestDurationDay && (
          <Card className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-medium text-muted-foreground">Longest Avg Duration</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{(data.longestDurationDay.avgMinutes / 60).toFixed(1)}h</div>
                <div className="text-xs text-muted-foreground">{data.longestDurationDay.date}</div>
              </div>
              <div className="text-xs text-muted-foreground/70">{data.longestDurationDay.repsWorked} reps</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );

  const renderIndividualRecords = () => {
    const filteredFp = getIndividualRecord(data.individualBestFp, data.rookieBestFp);
    const filteredPrmr = getIndividualRecord(data.individualBestPrmr, data.rookieBestPrmr);
    const filteredPres = getIndividualRecord(data.individualBestPresentations, data.rookieBestPresentations);
    const filteredTrans = getIndividualRecord(data.individualBestTransitions, data.rookieBestTransitions);
    const filteredPitches = getIndividualRecord(data.individualBestPitches, data.rookieBestPitches);
    const filteredDMs = getIndividualRecord(data.individualBestDMs, data.rookieBestDMs);
    const filteredDoors = getIndividualRecord(data.individualBestDoors, data.rookieBestDoors);

    const hasAnyRecord = filteredFp || filteredPrmr || filteredPres || filteredTrans || filteredPitches || filteredDMs || filteredDoors;

    if (!hasAnyRecord) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          No {rookieFilter === 'rookie' ? 'rookie ' : ''}records found for this period.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Output Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {filteredFp && (
            <Card className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Trophy className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Highest FP+</span>
              </div>
              <div className="text-lg font-bold text-primary">{formatAvgValue(filteredFp.value)} FP+</div>
              <div className="text-sm font-medium">{stripEmojis(filteredFp.repName)}</div>
              <div className="text-xs text-muted-foreground">{filteredFp.date}</div>
              {filteredFp.isRookie && (
                <span className="inline-block mt-1 text-xs bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">Rookie</span>
              )}
            </Card>
          )}

          {filteredPrmr && (
            <Card className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground">Highest PRMR</span>
              </div>
              <div className="text-lg font-bold text-green-600">${formatAvgValue(filteredPrmr.value, 0)}</div>
              <div className="text-sm font-medium">{stripEmojis(filteredPrmr.repName)}</div>
              <div className="text-xs text-muted-foreground">{filteredPrmr.date}</div>
              {filteredPrmr.isRookie && (
                <span className="inline-block mt-1 text-xs bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">Rookie</span>
              )}
            </Card>
          )}
        </div>

        {/* Activity Records */}
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">
          Individual Activity Records
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filteredPres && (
            <Card className="p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">Most Presentations</div>
              <div className="text-lg font-bold">{filteredPres.value}</div>
              <div className="text-sm font-medium">{stripEmojis(filteredPres.repName)}</div>
              <div className="text-xs text-muted-foreground">{filteredPres.date}</div>
            </Card>
          )}

          {filteredTrans && (
            <Card className="p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">Most Transitions</div>
              <div className="text-lg font-bold">{filteredTrans.value}</div>
              <div className="text-sm font-medium">{stripEmojis(filteredTrans.repName)}</div>
              <div className="text-xs text-muted-foreground">{filteredTrans.date}</div>
            </Card>
          )}

          {filteredPitches && (
            <Card className="p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">Most Pitches</div>
              <div className="text-lg font-bold">{filteredPitches.value}</div>
              <div className="text-sm font-medium">{stripEmojis(filteredPitches.repName)}</div>
              <div className="text-xs text-muted-foreground">{filteredPitches.date}</div>
            </Card>
          )}

          {filteredDMs && (
            <Card className="p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">Most DMs</div>
              <div className="text-lg font-bold">{filteredDMs.value}</div>
              <div className="text-sm font-medium">{stripEmojis(filteredDMs.repName)}</div>
              <div className="text-xs text-muted-foreground">{filteredDMs.date}</div>
            </Card>
          )}

          {filteredDoors && (
            <Card className="p-3 col-span-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Most Doors</div>
              <div className="text-lg font-bold">{filteredDoors.value}</div>
              <div className="text-sm font-medium">{stripEmojis(filteredDoors.repName)}</div>
              <div className="text-xs text-muted-foreground">{filteredDoors.date}</div>
            </Card>
          )}
        </div>
      </div>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="font-semibold">Best Periods</span>
          </div>
          <div className="flex items-center gap-2">
            {!isOpen && (
              <span className="text-xs text-muted-foreground">{getCollapsedSummary()}</span>
            )}
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'group' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('group')}
              className="gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Group
            </Button>
            <Button
              variant={viewMode === 'individual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('individual')}
              className="gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              Individual
            </Button>

            {/* Rookie Filter (only shown in individual mode) */}
            {viewMode === 'individual' && (
              <div className="ml-auto flex gap-1">
                <Button
                  variant={rookieFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setRookieFilter('all')}
                  className="text-xs h-7 px-2"
                >
                  All
                </Button>
                <Button
                  variant={rookieFilter === 'rookie' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setRookieFilter('rookie')}
                  className="text-xs h-7 px-2"
                >
                  Rookies
                </Button>
              </div>
            )}
          </div>

          {/* Content based on view mode */}
          {viewMode === 'group' ? renderGroupRecords() : renderIndividualRecords()}

          {/* Day of Week Analysis */}
          {dailyTrend && dailyTrend.length > 1 && (
            <div className="mt-6 pt-4 border-t border-border">
              <DayOfWeekBestPeriods dailyTrend={dailyTrend} />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
