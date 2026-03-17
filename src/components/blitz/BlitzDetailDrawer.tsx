import { MapPin, CalendarDays, Footprints, Flame, DollarSign, Clock, Users, Trophy, TrendingUp, ChevronRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatBlitzDateRange } from "@/utils/blitzDateUtils";
import { formatFP, formatPRMR } from "@/lib/formatters";
import { useBlitzDetailStats } from "@/hooks/useBlitzDetailStats";
import { useBlitzAchievements } from "@/hooks/useBlitzAchievements";
import { format } from "date-fns";

interface BlitzDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blitz: {
    name: string;
    location: string | null;
    startDate: string;
    endDate: string;
  } | null;
}

export function BlitzDetailDrawer({ open, onOpenChange, blitz }: BlitzDetailDrawerProps) {
  const { data: stats, isLoading } = useBlitzDetailStats(
    blitz?.startDate ?? null,
    blitz?.endDate ?? null
  );
  const { data: achievements } = useBlitzAchievements(
    blitz?.startDate ?? null,
    blitz?.endDate ?? null
  );

  if (!blitz) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90svh]">
        {/* Sticky header */}
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-xl font-bold">{blitz.name}</DrawerTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {blitz.location && (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>{blitz.location}</span>
                <span>·</span>
              </>
            )}
            <span>{formatBlitzDateRange(blitz.startDate, blitz.endDate)}</span>
          </div>
        </DrawerHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Loading stats...
          </div>
        ) : !stats ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            No data available for this blitz.
          </div>
        ) : (
          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1 text-xs">Overview</TabsTrigger>
                <TabsTrigger value="inputs" className="flex-1 text-xs">Inputs</TabsTrigger>
                <TabsTrigger value="customers" className="flex-1 text-xs">Customers</TabsTrigger>
                <TabsTrigger value="wins" className="flex-1 text-xs">Wins</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-3 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <StatCard icon={<CalendarDays className="w-4 h-4" />} value={`${stats.daysWorked}`} label="Days Worked" />
                  <StatCard icon={<Clock className="w-4 h-4" />} value={`${stats.totalHoursWorked.toFixed(1)}`} label="Hours" />
                  <StatCard icon={<Footprints className="w-4 h-4" />} value={stats.totalDoors.toLocaleString()} label="Doors" />
                  <StatCard icon={<Users className="w-4 h-4" />} value={`${stats.totalCloses}`} label="Closes" />
                  <StatCard icon={<Flame className="w-4 h-4" />} value={formatFP(stats.totalFp)} label="FP+" />
                  <StatCard icon={<DollarSign className="w-4 h-4" />} value={formatPRMR(stats.totalPrmr)} label="PRMR" />
                </div>

                {/* Daily breakdown */}
                {stats.dailyEntries.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Daily Breakdown</h3>
                    <div className="space-y-1">
                      {stats.dailyEntries.filter(d => d.doors > 0 || d.fp > 0).map(day => (
                        <div key={day.date} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                          <span className="text-sm font-medium text-foreground">
                            {format(new Date(day.date + 'T12:00:00'), 'EEE, MMM d')}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{day.doors} doors</span>
                            {day.fp > 0 && <span className="text-primary font-semibold">{formatFP(day.fp)} FP+</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Inputs Tab */}
              <TabsContent value="inputs" className="mt-3 space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Funnel</h3>
                  <div className="space-y-1">
                    <FunnelRow label="Doors" value={stats.totalDoors} />
                    <FunnelRow label="Decision Makers" value={stats.totalDMs} />
                    <FunnelRow label="Pitches" value={stats.totalPitches} />
                    <FunnelRow label="Transitions" value={stats.totalTransitions} />
                    <FunnelRow label="Presentations" value={stats.totalPresentations} />
                    <FunnelRow label="Closes" value={stats.totalCloses} />
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pace</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard icon={<TrendingUp className="w-4 h-4" />} value={stats.doorsPerHour.toFixed(1)} label="Doors/Hr" />
                    <StatCard icon={<TrendingUp className="w-4 h-4" />} value={`${(stats.dmsPerDoor * 100).toFixed(0)}%`} label="DM Rate" />
                    <StatCard icon={<TrendingUp className="w-4 h-4" />} value={`${(stats.closeRate * 100).toFixed(1)}%`} label="Close Rate" />
                    <StatCard 
                      icon={<TrendingUp className="w-4 h-4" />} 
                      value={stats.totalCloses > 0 ? (stats.totalDoors / stats.totalCloses).toFixed(0) : '—'} 
                      label="Doors/Close" 
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Customers Tab */}
              <TabsContent value="customers" className="mt-3 space-y-3">
                {stats.sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-8 text-center">No sales logged during this blitz</p>
                ) : (
                  <div className="space-y-2">
                    {stats.sales.map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {sale.customerName || (sale.type === 'fp' ? 'New Customer' : 'Upgrade')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sale.date + 'T12:00:00'), 'MMM d')}
                            {sale.soldAtLocal && ` · ${sale.soldAtLocal}`}
                            {' · '}{sale.type.toUpperCase()}
                            {sale.installStatus === 'pending' && ' · Pending'}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-foreground">${sale.prmr}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Wins Tab */}
              <TabsContent value="wins" className="mt-3 space-y-3">
                {(!achievements || achievements.length === 0) ? (
                  <p className="text-sm text-muted-foreground italic py-8 text-center">No records or achievements during this blitz</p>
                ) : (
                  <div className="space-y-2">
                    {achievements.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Trophy className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{a.label}</p>
                          {a.value && <p className="text-xs text-muted-foreground">{a.value}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-primary/5 border border-primary/10">
      <div className="text-primary">{icon}</div>
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

function FunnelRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value.toLocaleString()}</span>
    </div>
  );
}
