import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useTeamInsightsData } from "@/hooks/useTeamInsightsData";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter, Users } from "lucide-react";
import { TeamFilterSheet } from "@/components/TeamFilterSheet";

const TeamReports = () => {
  const { data: accessData, isLoading: accessLoading } = useTeamAccess();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [excludeUserIds, setExcludeUserIds] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'totals' | 'individual'>('totals');

  // Initialize selected users when access data loads
  const effectiveUserIds = selectedUserIds.length > 0 
    ? selectedUserIds 
    : (accessData?.accessibleUserIds || []);

  const { data: insightsData, isLoading: insightsLoading } = useTeamInsightsData({
    userIds: effectiveUserIds,
    dateRange,
    excludeUserIds,
  });

  if (accessLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (accessData?.accessLevel === 'none') {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You don't have access to team reporting features.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Reports</h1>
            <p className="text-muted-foreground">
              View and analyze your team's performance
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setIsFilterOpen(true)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter Team
          </Button>
        </div>

        {insightsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : insightsData ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total FP</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{insightsData.totalFP.toFixed(1)}</div>
                  <p className="text-xs text-muted-foreground">
                    {insightsData.totalUpgradeFP.toFixed(1)} upgrade FP
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total PRMR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${insightsData.totalPRMR.toFixed(0)}</div>
                  <p className="text-xs text-muted-foreground">
                    ${insightsData.totalUpgradePRMR.toFixed(0)} from upgrades
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Doors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{insightsData.totalDoors}</div>
                  <p className="text-xs text-muted-foreground">
                    {insightsData.doorsToFp.toFixed(1)} doors per FP
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Key Ratios */}
            <Card>
              <CardHeader>
                <CardTitle>Key Ratios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Doors → FP</p>
                    <p className="text-2xl font-bold">{insightsData.doorsToFp.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pitches → FP</p>
                    <p className="text-2xl font-bold">{insightsData.pitchesToFp.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transitions → FP</p>
                    <p className="text-2xl font-bold">{insightsData.transitionsToFp.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Presentations → Close</p>
                    <p className="text-2xl font-bold">{insightsData.presentationsToClose.toFixed(1)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Productivity Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Productivity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Doors per Hour</p>
                    <p className="text-2xl font-bold">{insightsData.doorsPerHour.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Hours to FP</p>
                    <p className="text-2xl font-bold">{insightsData.hoursToFp.toFixed(1)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual Breakdown */}
            {viewMode === 'individual' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Individual Rep Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {insightsData.repBreakdown.map((rep) => (
                      <div key={rep.userId} className="border-b pb-4 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold">{rep.name}</p>
                            <p className="text-sm text-muted-foreground">{rep.year}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{rep.fp.toFixed(1)} FP</p>
                            <p className="text-sm text-muted-foreground">${rep.prmr.toFixed(0)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Doors</p>
                            <p className="font-semibold">{rep.doors}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pitches</p>
                            <p className="font-semibold">{rep.pitches}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Presentations</p>
                            <p className="font-semibold">{rep.presentations}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Closes</p>
                            <p className="font-semibold">{rep.closes}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}

        <TeamFilterSheet
          open={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          accessData={accessData}
          selectedUserIds={selectedUserIds}
          onUserIdsChange={setSelectedUserIds}
          excludeUserIds={excludeUserIds}
          onExcludeUserIdsChange={setExcludeUserIds}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>
    </Layout>
  );
};

export default TeamReports;
