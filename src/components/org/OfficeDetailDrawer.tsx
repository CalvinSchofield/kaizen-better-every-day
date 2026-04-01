import { useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, MapPin, Users, UserCheck, Shield, GitBranch } from "lucide-react";
import { getCleanName, getInitials } from "@/utils/nameUtils";
import { SIGNED_PLUS_STAGES } from "@/utils/stageConstants";

interface OfficeDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  office: {
    id: string;
    name: string;
    location?: string | null;
  } | null;
  orgData?: {
    officeStaff: { office_id: string; user_id: string; role: string }[];
    mgmtGroups: { id: string; name: string; lead_user_id: string | null; office_id: string | null; sr_mgmt_group_id: string | null }[];
    srMgmtGroups: { id: string; name: string; lead_user_id: string | null; office_id: string | null }[];
    teams: { id: string; name: string; lead_user_id: string | null }[];
    teamMgmt: { team_id: string; mgmt_group_id: string }[];
    reps: { user_id: string; name: string; profile_photo_url?: string | null; year?: string | null; stage?: string | null }[];
    recruits: { id: string; team_id: string | null; mgmt_group_id: string | null; stage: string | null; recruiter_user_id: string | null }[];
  };
}

/** Count total downline size for a recruiter (recursive) */
function countDownline(
  userId: string,
  recruitsByRecruiter: Map<string, string[]>,
  visited: Set<string>
): number {
  if (visited.has(userId)) return 0;
  visited.add(userId);
  const directRecruits = recruitsByRecruiter.get(userId) || [];
  let count = directRecruits.length;
  for (const recruitId of directRecruits) {
    count += countDownline(recruitId, recruitsByRecruiter, visited);
  }
  return count;
}

export const OfficeDetailDrawer = ({ open, onOpenChange, office, orgData }: OfficeDetailDrawerProps) => {
  const details = useMemo(() => {
    if (!office || !orgData) return null;

    const repMap = new Map(orgData.reps.map(r => [r.user_id, r]));

    // Area Directors
    const staff = orgData.officeStaff.filter(s => s.office_id === office.id);
    const areaDirectors = staff.map(s => {
      const rep = repMap.get(s.user_id);
      return {
        userId: s.user_id,
        name: rep ? getCleanName(rep.name) : "Unknown",
        profilePhotoUrl: rep?.profile_photo_url || null,
      };
    });

    // Collect all MGMT group IDs in this office
    const officeMgmtGroupIds = new Set<string>();
    const officeSrMgmtGroupIds = new Set<string>();

    orgData.srMgmtGroups.forEach((smg: any) => {
      if (smg.office_id === office.id) officeSrMgmtGroupIds.add(smg.id);
    });
    orgData.mgmtGroups.forEach(mg => {
      if (mg.office_id === office.id) officeMgmtGroupIds.add(mg.id);
    });
    officeSrMgmtGroupIds.forEach(srId => {
      orgData.mgmtGroups.filter(mg => mg.sr_mgmt_group_id === srId).forEach(mg => {
        officeMgmtGroupIds.add(mg.id);
      });
    });

    // MGMT Groups with leader info
    const mgmtGroupDetails = Array.from(officeMgmtGroupIds).map(mgId => {
      const mg = orgData.mgmtGroups.find(m => m.id === mgId);
      if (!mg) return null;
      const leader = mg.lead_user_id ? repMap.get(mg.lead_user_id) : null;

      const teamIds = orgData.teamMgmt
        .filter(tm => tm.mgmt_group_id === mgId)
        .map(tm => tm.team_id);

      const repCount = orgData.recruits.filter(r =>
        (r.mgmt_group_id === mgId || (r.team_id && teamIds.includes(r.team_id))) &&
        r.stage && SIGNED_PLUS_STAGES.some(s => s.toLowerCase() === r.stage!.toLowerCase())
      ).length;

      return {
        id: mg.id,
        name: mg.name,
        leaderName: leader ? getCleanName(leader.name) : null,
        leaderPhoto: leader?.profile_photo_url || null,
        teamCount: teamIds.length,
        repCount,
      };
    }).filter(Boolean) as { id: string; name: string; leaderName: string | null; leaderPhoto: string | null; teamCount: number; repCount: number }[];

    // Team leads across office
    const officeTeamIds = new Set<string>();
    mgmtGroupDetails.forEach(mg => {
      orgData.teamMgmt
        .filter(tm => tm.mgmt_group_id === mg.id)
        .forEach(tm => officeTeamIds.add(tm.team_id));
    });
    const teamLeads = Array.from(officeTeamIds).map(tId => {
      const team = orgData.teams.find(t => t.id === tId);
      if (!team?.lead_user_id) return null;
      const rep = repMap.get(team.lead_user_id);
      return {
        teamName: team.name,
        name: rep ? getCleanName(rep.name) : "Unknown",
        profilePhotoUrl: rep?.profile_photo_url || null,
      };
    }).filter(Boolean) as { teamName: string; name: string; profilePhotoUrl: string | null }[];

    // Recruiters section: find reps in this office with 5+ downline
    // Build recruiter_user_id -> [recruit user_ids] map
    // First, map recruit names to user_ids
    const repNameToUserId = new Map<string, string>();
    orgData.reps.forEach(r => {
      repNameToUserId.set(getCleanName(r.name).toLowerCase(), r.user_id);
    });

    // Build recruiter map using recruiter_user_id
    const recruitsByRecruiter = new Map<string, string[]>();
    const officeRecruitsSet = new Set<string>();

    // Get all recruits in office teams/mgmt groups
    const allOfficeTeamIds = new Set(officeTeamIds);
    orgData.recruits.forEach(r => {
      if (
        (r.mgmt_group_id && officeMgmtGroupIds.has(r.mgmt_group_id)) ||
        (r.team_id && allOfficeTeamIds.has(r.team_id))
      ) {
        officeRecruitsSet.add(r.id);
      }
    });

    // Build global recruiter->recruits map (using user_id matching)
    orgData.recruits.forEach(r => {
      if (r.recruiter_user_id) {
        const existing = recruitsByRecruiter.get(r.recruiter_user_id) || [];
        existing.push(r.recruiter_user_id); // We just need count, use recruiter as proxy
        recruitsByRecruiter.set(r.recruiter_user_id, existing);
      }
    });

    // Actually build it properly: recruiter_user_id -> list of recruit IDs
    const recruiterToRecruits = new Map<string, string[]>();
    orgData.recruits.forEach(r => {
      if (r.recruiter_user_id) {
        const list = recruiterToRecruits.get(r.recruiter_user_id) || [];
        list.push(r.id);
        recruiterToRecruits.set(r.recruiter_user_id, list);
      }
    });

    // Find reps in office with 5+ total downline
    const officeRepUserIds = new Set<string>();
    // Leaders of mgmt groups and teams
    mgmtGroupDetails.forEach(mg => {
      const mgFull = orgData.mgmtGroups.find(m => m.id === mg.id);
      if (mgFull?.lead_user_id) officeRepUserIds.add(mgFull.lead_user_id);
    });
    Array.from(officeTeamIds).forEach(tId => {
      const team = orgData.teams.find(t => t.id === tId);
      if (team?.lead_user_id) officeRepUserIds.add(team.lead_user_id);
    });
    // All reps in office recruits
    orgData.recruits.forEach(r => {
      if (
        (r.mgmt_group_id && officeMgmtGroupIds.has(r.mgmt_group_id)) ||
        (r.team_id && allOfficeTeamIds.has(r.team_id))
      ) {
        // Find rep user_id by matching recruit to rep
        // recruits don't have user_id directly, but reps do
      }
    });
    // Also add all reps who have office_id
    orgData.reps.forEach(r => {
      if ((r as any).office_id === office.id) officeRepUserIds.add(r.user_id);
    });

    const topRecruiters = Array.from(officeRepUserIds)
      .map(userId => {
        const downlineSize = countDownline(userId, recruiterToRecruits, new Set());
        const rep = repMap.get(userId);
        return {
          userId,
          name: rep ? getCleanName(rep.name) : "Unknown",
          profilePhotoUrl: rep?.profile_photo_url || null,
          downlineSize,
        };
      })
      .filter(r => r.downlineSize >= 5)
      .sort((a, b) => b.downlineSize - a.downlineSize);

    const totalReps = mgmtGroupDetails.reduce((sum, mg) => sum + mg.repCount, 0);

    return { areaDirectors, mgmtGroupDetails, teamLeads, totalReps, topRecruiters };
  }, [office, orgData]);

  if (!office || !details) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="overflow-y-auto">
          {/* Hero header with smooth gradient */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/12 via-amber-600/6 to-transparent" />
            <div className="relative px-5 pt-5 pb-5">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <DrawerHeader className="p-0 text-left">
                    <DrawerTitle className="text-xl font-bold">{office.name}</DrawerTitle>
                  </DrawerHeader>
                  {office.location && (
                    <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-sm">{office.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats row with labels above numbers */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="rounded-xl p-3 bg-card border border-border/50">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Reps</div>
                  <div className="text-2xl font-bold text-foreground">{details.totalReps}</div>
                </div>
                <div className="rounded-xl p-3 bg-card border border-border/50">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">MGMT Groups</div>
                  <div className="text-2xl font-bold text-foreground">{details.mgmtGroupDetails.length}</div>
                </div>
                <div className="rounded-xl p-3 bg-card border border-border/50">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Teams</div>
                  <div className="text-2xl font-bold text-foreground">{details.teamLeads.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-6 space-y-5">
            {/* Area Directors */}
            {details.areaDirectors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-amber-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Area {details.areaDirectors.length === 1 ? "Director" : "Directors"}
                  </h3>
                </div>
                <div className="space-y-2">
                  {details.areaDirectors.map((ad) => (
                    <div key={ad.userId} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                      <Avatar className="h-10 w-10 border-2 border-amber-500/40">
                        {ad.profilePhotoUrl && <AvatarImage src={ad.profilePhotoUrl} />}
                        <AvatarFallback className="bg-amber-500/10 text-amber-500 text-xs font-bold">
                          {getInitials(ad.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{ad.name}</div>
                        <div className="text-xs text-amber-500 font-medium">Area Director</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator className="bg-border/50" />

            {/* MGMT Groups */}
            {details.mgmtGroupDetails.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-blue-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">MGMT Groups</h3>
                </div>
                <div className="space-y-2">
                  {details.mgmtGroupDetails.map((mg) => (
                    <div key={mg.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                      {mg.leaderPhoto ? (
                        <Avatar className="h-9 w-9 border-2 border-blue-500/40">
                          <AvatarImage src={mg.leaderPhoto} />
                          <AvatarFallback className="bg-blue-500/10 text-blue-500 text-xs font-bold">
                            {getInitials(mg.leaderName || "")}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{mg.name}</div>
                        {mg.leaderName && (
                          <div className="text-xs text-muted-foreground">Led by {mg.leaderName}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {mg.teamCount} {mg.teamCount === 1 ? "team" : "teams"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {mg.repCount} reps
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team Leads */}
            {details.teamLeads.length > 0 && (
              <div>
                <Separator className="bg-border/50 mb-5" />
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="h-4 w-4 text-green-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Leads</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {details.teamLeads.map((tl, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-border/50">
                      <Avatar className="h-8 w-8 border-2 border-green-500/30">
                        {tl.profilePhotoUrl && <AvatarImage src={tl.profilePhotoUrl} />}
                        <AvatarFallback className="bg-green-500/10 text-green-500 text-[10px] font-bold">
                          {getInitials(tl.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{tl.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{tl.teamName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Recruiters */}
            {details.topRecruiters.length > 0 && (
              <div>
                <Separator className="bg-border/50 mb-5" />
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="h-4 w-4 text-purple-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recruiters</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {details.topRecruiters.map((rec) => (
                    <div key={rec.userId} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-border/50">
                      <Avatar className="h-8 w-8 border-2 border-purple-500/30">
                        {rec.profilePhotoUrl && <AvatarImage src={rec.profilePhotoUrl} />}
                        <AvatarFallback className="bg-purple-500/10 text-purple-500 text-[10px] font-bold">
                          {getInitials(rec.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{rec.name}</div>
                        <div className="text-[10px] text-muted-foreground">{rec.downlineSize} in downline</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
