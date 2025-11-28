import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, LogOut, ExternalLink, Download, Target, Users, DollarSign, Edit2, TrendingUp, HelpCircle, MessageSquare, Calculator, CheckCircle2, Calendar, Zap, Moon, ChevronRight, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { RepData } from "@/hooks/useRepData";
import { RecruitingFlowCarousel } from "@/components/RecruitingFlowCarousel";
import { useBlitzes } from "@/hooks/useBlitzes";
import { VetBlitzCard } from "@/components/VetBlitzCard";
import { VetAlertCard } from "@/components/VetAlertCard";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";

interface VetHomeProps {
  repData: RepData;
  onSync: () => void;
  isSyncing: boolean;
  syncSuccess: boolean;
}

// Dashboard mappings based on leader email
const DASHBOARD_MAP: Record<string, string> = {
  "adam.schofield@vivint.com": "https://www.notion.so/calvinschofield/Adam-s-Dashboard-288070fe3bc2806d9119f85c9f12a8a0?source=copy_link",
  "ammon.allan@vivint.com": "https://www.notion.so/calvinschofield/Ammon-s-Dashboard-288070fe3bc2803eb8abdf177e7b442c?source=copy_link",
  "christian.fabian@vivint.com": "https://www.notion.so/calvinschofield/Christian-s-Dashboard-287070fe3bc28033b770c6c28f763401?source=copy_link",
  "javier.estrada@vivint.com": "https://www.notion.so/calvinschofield/Javier-s-Dashboard-287070fe3bc28027a58bc4ae500c0d2e?source=copy_link",
  "quinn.gleed@vivint.com": "https://www.notion.so/calvinschofield/Quinn-s-Dashboard-287070fe3bc28097932bf35055dfaf1b?source=copy_link",
  "misael.sanchez@vivint.com": "https://www.notion.so/calvinschofield/Misael-s-Dashboard-287070fe3bc28028a14de6a224b4346c?source=copy_link",
  "ansel.severson@vivint.com": "https://www.notion.so/calvinschofield/Ansel-s-Dashboard-28b070fe3bc280ed9700f80a1d3410a2?source=copy_link",
};

// Pay scale documents
const PAY_SCALES = [
  { label: "Leader Pay Scale", file: "/documents/2025_Leader_Payscale.pdf" },
  { label: "Recruiter Pay Scale", file: "/documents/2025_Recruiter_Pay_Scale.pdf" },
  { label: "Sales Rep Pay Scale", file: "/documents/2025_Sales_Rep_Payscale.pdf" },
  { label: "Sales Rules", file: "/documents/2025_Sales_Rules.pdf" },
];

interface TeamMember {
  notionPageId: string;
  name: string;
  email: string | null;
  phone: string | null;
  blitzReady: boolean;
  committedBlitzes: string[];
  ipadAssigned: boolean;
  year: string | null;
  stage: string | null;
  onboardingStatus: string | null;
}

export const VetHome = ({ repData, onSync, isSyncing, syncSuccess }: VetHomeProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [isEditingStats, setIsEditingStats] = useState(false);
  const [helpSheetOpen, setHelpSheetOpen] = useState(false);
  const { allBlitzes, loading: blitzesLoading } = useBlitzes();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [teamLoading, setTeamLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const [weather, setWeather] = useState<Array<{ date: string; high: number; low: number; weatherCode: number; precipitation: number }>>([]);
  const [loadingWeather, setLoadingWeather] = useState(false);
  
  // Get FP+ from daily entries (preseason only)
  const { totalFP: personalFP, isLoading: loadingFP } = usePreseasonFP();
  
  // Get weather icon based on WMO weather code
  const getWeatherIcon = (code: number) => {
    if (code === 0) return "☀️"; // Clear sky
    if (code <= 3) return "⛅"; // Partly cloudy
    if (code <= 48) return "🌫️"; // Fog
    if (code <= 57) return "🌦️"; // Drizzle
    if (code <= 67) return "🌧️"; // Rain
    if (code <= 77) return "❄️"; // Snow
    if (code <= 82) return "🌧️"; // Rain showers
    if (code <= 86) return "🌨️"; // Snow showers
    return "⛈️"; // Thunderstorm
  };

  // Check if weather code indicates rain
  const isRainy = (code: number) => {
    return code >= 51 && code <= 82; // Drizzle, rain, and rain showers
  };
  
  // Auto-refresh on component mount (when PWA reopens)
  useEffect(() => {
    onSync();
  }, []);

  // Get next upcoming blitz from committed blitzes
  const nextBlitz = repData.committed_blitzes && Array.isArray(repData.committed_blitzes) 
    ? (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingBlitzes = repData.committed_blitzes
          .filter((blitz: any) => {
            if (!blitz || typeof blitz !== 'object' || !blitz.date) return false;
            const blitzEndDate = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
            blitzEndDate.setHours(0, 0, 0, 0);
            return blitzEndDate >= today;
          })
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return upcomingBlitzes[0] || null;
      })()
    : null;

  // Check if vet had past blitzes but no upcoming ones
  const committedBlitzes = (repData.committed_blitzes as any[]) || [];
  const hasPastBlitzes = committedBlitzes.some((blitz: any) => {
    if (!blitz?.endDate) return false;
    const endDate = new Date(blitz.endDate);
    return endDate < new Date();
  });

  const daysUntilBlitz = nextBlitz ? Math.ceil((new Date(nextBlitz.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  // Fetch weather for upcoming blitz
  useEffect(() => {
    const fetchWeather = async () => {
      if (!nextBlitz || !daysUntilBlitz || daysUntilBlitz > 14 || daysUntilBlitz < 0) {
        setWeather([]);
        return;
      }

      setLoadingWeather(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-blitz-weather', {
          body: {
            location: nextBlitz.location,
            startDate: nextBlitz.date,
            endDate: nextBlitz.endDate || nextBlitz.date,
          },
        });

        if (error) throw error;
        if (data?.forecasts) {
          setWeather(data.forecasts);
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
  }, [nextBlitz, daysUntilBlitz]);

  // Fetch team members for team leads
  const fetchTeamMembers = useCallback(async () => {
      if (!repData?.notion_page_id) return;

      setTeamLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('fetch-team-members', {
          body: { leaderNotionPageId: repData.notion_page_id },
        });

        if (error) throw error;

        if (data) {
          setIsTeamLead(data.isTeamLead || false);
          
          if (data.teamMembers) {
            // Filter out the vet themselves from their team list
            const filteredMembers = data.teamMembers.filter(
              (member: TeamMember) => member.notionPageId !== repData.notion_page_id
            );
            setTeamMembers(filteredMembers);
          }
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
        toast({
          title: "Error loading team",
          description: "Could not load team members. Please refresh.",
          variant: "destructive",
        });
      } finally {
        setTeamLoading(false);
      }
  }, [repData?.notion_page_id, toast]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers, refreshTrigger]);
  
  // Local state for editable stats - initialize from repData
  const [personalFPGoal, setPersonalFPGoal] = useState(repData.personal_fp_goal ?? 0);
  const [repsWithSale, setRepsWithSale] = useState(repData.reps_with_sale ?? 0);
  const [repsWithSaleGoal, setRepsWithSaleGoal] = useState(repData.reps_with_sale_goal ?? 0);
  
  // Temporary string states for editing
  const [personalFPGoalInput, setPersonalFPGoalInput] = useState(String(repData.personal_fp_goal ?? 0));
  const [repsWithSaleInput, setRepsWithSaleInput] = useState(String(repData.reps_with_sale ?? 0));
  const [repsWithSaleGoalInput, setRepsWithSaleGoalInput] = useState(String(repData.reps_with_sale_goal ?? 0));

  // Sync local state with repData changes
  useEffect(() => {
    setPersonalFPGoal(repData.personal_fp_goal ?? 0);
    setRepsWithSale(repData.reps_with_sale ?? 0);
    setRepsWithSaleGoal(repData.reps_with_sale_goal ?? 0);
    setPersonalFPGoalInput(String(repData.personal_fp_goal ?? 0));
    setRepsWithSaleInput(String(repData.reps_with_sale ?? 0));
    setRepsWithSaleGoalInput(String(repData.reps_with_sale_goal ?? 0));
  }, [repData]);

  const firstName = repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0];
  const userEmail = repData.email?.toLowerCase();
  const dashboardUrl = userEmail ? DASHBOARD_MAP[userEmail] : null;
  
  const personalFPProgress = personalFPGoal > 0 ? (personalFP / personalFPGoal) * 100 : 0;
  const repsProgress = repsWithSaleGoal > 0 ? (repsWithSale / repsWithSaleGoal) * 100 : 0;
  const goalsNotSet = personalFPGoal === 0 || repsWithSaleGoal === 0;

  const saveGoals = async () => {
    try {
      // Convert inputs to numbers
      const fpGoalValue = Math.round(parseFloat(personalFPGoalInput) * 10) / 10 || 0;
      const repsValue = parseInt(repsWithSaleInput) || 0;
      const repsGoalValue = parseInt(repsWithSaleGoalInput) || 0;
      
      const { error } = await supabase
        .from('reps')
        .update({
          personal_fp_goal: fpGoalValue,
          reps_with_sale: repsValue,
          reps_with_sale_goal: repsGoalValue,
        })
        .eq('id', repData.id);

      if (error) throw error;

      // Update local state with the saved values
      setPersonalFPGoal(fpGoalValue);
      setRepsWithSale(repsValue);
      setRepsWithSaleGoal(repsGoalValue);
      setPersonalFPGoalInput(String(fpGoalValue));
      setRepsWithSaleInput(String(repsValue));
      setRepsWithSaleGoalInput(String(repsGoalValue));

      toast({
        title: "Goals saved",
        description: "Your progress has been updated successfully",
      });
      setIsEditingStats(false);
    } catch (error) {
      console.error("Error saving goals:", error);
      toast({
        title: "Save failed",
        description: "Could not save your goals. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    setLogoutSheetOpen(true);
  };

  const confirmLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout failed",
        description: "Could not log out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLogoutSheetOpen(false);
    }
  };

  const copyToClipboard = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: `${label} link copied to clipboard`,
    });
  };

  const openLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleRefresh = async () => {
    onSync();
    setRefreshTrigger(prev => prev + 1);
  };

  const { containerRef, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
    isRefreshing: isSyncing,
    threshold: 80,
  });

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const response = await fetch(filePath);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: `${fileName} is downloading`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download file",
        variant: "destructive",
      });
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-b from-background to-secondary/30 overflow-y-auto">
      {/* Pull to refresh hint */}
      <div 
        className="fixed top-0 left-0 right-0 flex justify-center pt-2 z-50 transition-opacity duration-200 pointer-events-none"
        style={{ opacity: pullDistance > 0 ? Math.min(pullDistance / 80, 0.6) : 0 }}
      >
        <p className="text-xs text-muted-foreground">Pull down to refresh</p>
      </div>
      
      {/* Header with colored background */}
      <div className="bg-primary text-primary-foreground p-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              {(() => {
                const hour = new Date().getHours();
                let greeting = "Good evening";
                if (hour < 12) {
                  greeting = "Good morning";
                } else if (hour < 18) {
                  greeting = "Good afternoon";
                }
                
                return (
                  <h1 className="text-3xl font-bold tracking-tight">
                    {greeting}, {firstName}
                  </h1>
                );
              })()}
            </div>
            <div className="flex gap-2 flex-shrink-0 self-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isSyncing}
                className={`rounded-full transition-all duration-300 border ${
                  syncSuccess 
                    ? 'bg-green-500 text-white border-green-500 hover:bg-green-500' 
                    : 'bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 border-primary-foreground/20'
                }`}
                aria-label="Refresh data"
              >
                {syncSuccess ? (
                  <CheckCircle2 className="w-4 h-4 animate-scale-in" />
                ) : (
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="rounded-full text-primary-foreground hover:bg-primary-foreground/10"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* CTA Card - Clickable (scrolls to blitz section) */}
          {!nextBlitz ? (
            <button
              onClick={() => {
                const blitzCard = document.querySelector('[data-blitz-card]');
                if (blitzCard) {
                  blitzCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="group flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all mt-4"
            >
              <span className="text-2xl flex-shrink-0">📆</span>
              <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">
                {hasPastBlitzes 
                  ? "Pick a blitz trip and commit to making your next sale"
                  : "Pick a blitz trip and commit to making your first sale"}
              </p>
              <ChevronRight className="w-5 h-5 text-primary-foreground/60 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </button>
          ) : (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tripDate = new Date(nextBlitz.date);
            const diffTime = tripDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let ctaText = "";
            let ctaIcon = "";
            
            if (diffDays <= 7) {
              ctaText = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} until ${nextBlitz.location || 'your blitz'} — prep makes perfect`;
              ctaIcon = "⚡";
            } else {
              ctaText = `${nextBlitz.location || 'Your blitz'} in ${diffDays} days — stay sharp and keep training!`;
              ctaIcon = "🎯";
            }
            
            return (
              <button
                onClick={() => setWeatherSheetOpen(true)}
                className="group flex items-center gap-3 text-left w-full px-6 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/15 transition-all mb-3"
              >
                <span className="text-2xl flex-shrink-0">{ctaIcon}</span>
                <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">
                  {ctaText}
                </p>
                <ChevronRight className="w-5 h-5 text-primary-foreground/60 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </button>
            );
          })()}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4 pb-32">
        {/* Dynamic Alert Card for Team Leads */}
        {isTeamLead && !teamLoading && (
          <VetAlertCard 
            teamMembers={teamMembers}
            allBlitzes={allBlitzes}
            onTeamMemberUpdate={(notionPageId, updates) => {
              setTeamMembers(prev => 
                prev.map(m => 
                  m.notionPageId === notionPageId 
                    ? { ...m, ...updates }
                    : m
                )
              );
            }}
          />
        )}

        {/* Monday Night Lights Alert - Shows only on Mondays 5am-8pm MST */}
        {(() => {
          const now = new Date();
          const mstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
          const dayOfWeek = mstTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
          const hour = mstTime.getHours();
          
          // Show only on Mondays (1) between 5am (5) and 8pm (20)
          const shouldShowMondayNights = dayOfWeek === 1 && hour >= 5 && hour < 20;
          
          return shouldShowMondayNights ? (
            <Card className="mb-6 shadow-sm border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Moon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Monday Night Lights</h3>
                    <p className="text-sm text-muted-foreground">
                      Happening now at <strong>6pm MST</strong> — watch Slack for the link!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}

        {/* Status Dashboard Card */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Your Progress</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-3xl">
                    <SheetHeader>
                      <SheetTitle>Need help setting goals?</SheetTitle>
                      <SheetDescription>
                        Get with your leaders to set preseason goals that push you but are attainable.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        This online preseason calculator also is super helpful in determining what recruiting work needs to be done in order to hit goals on the year.
                      </p>
                      <div className="space-y-3">
                        <Button 
                          variant="outline"
                          className="w-full h-12 text-base"
                          onClick={() => openLink("https://vivintevolution.com/2026-season-calculator/")}
                        >
                          <Calculator className="h-5 w-5 mr-2" />
                          Recruiting Calculator
                        </Button>
                        <Button 
                          className="w-full h-12 text-base"
                          onClick={() => {
                            const phone = repData.team_leader_phone;
                            if (phone) {
                              window.location.href = `sms:${phone}`;
                            } else {
                              toast({
                                title: "No phone number",
                                description: "Team leader phone number not available",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <MessageSquare className="h-5 w-5 mr-2" />
                          Message Leader
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
                {isEditingStats ? (
                  <Button
                    size="sm"
                    onClick={saveGoals}
                  >
                    Save Goals
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingStats(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-1.5" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {goalsNotSet && !isEditingStats && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-center font-medium">
                  👆 Tap <strong>Edit</strong> to set your preseason goals
                </p>
              </div>
            )}
            
            {/* Personal FP+ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium">Personal FP+</Label>
                  {isEditingStats && (
                    <button
                      onClick={() => {
                        navigate('/calendar');
                        toast({
                          title: "Track daily",
                          description: "Add your daily entries here to see your FP+ grow automatically",
                        });
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Track numbers info"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isEditingStats ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {personalFP % 1 === 0 ? personalFP : personalFP.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={personalFPGoalInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow typing decimal point and numbers
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setPersonalFPGoalInput(val);
                        }
                      }}
                      onBlur={(e) => {
                        // Round to 1 decimal place and update actual value
                        const val = parseFloat(e.target.value) || 0;
                        const rounded = Math.round(val * 10) / 10;
                        setPersonalFPGoal(rounded);
                        setPersonalFPGoalInput(String(rounded));
                      }}
                      onFocus={(e) => {
                        e.target.select();
                        setPersonalFPGoalInput(String(personalFPGoal));
                      }}
                      className="w-16 h-8 text-center"
                      placeholder="Goal"
                    />
                  </div>
                ) : (
                  <span className="text-lg font-bold">
                    {personalFP % 1 === 0 ? personalFP : personalFP.toFixed(1)} / {personalFPGoal % 1 === 0 ? personalFPGoal : personalFPGoal.toFixed(1)}
                  </span>
                )}
              </div>
              <Progress value={personalFPProgress} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {Math.round(personalFPProgress)}% towards your personal preseason sales goal
              </p>
            </div>

            {/* Reps with a Sale */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Reps with a Sale</Label>
                {isEditingStats ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      enterKeyHint="done"
                      value={repsWithSaleInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d+$/.test(val)) {
                          setRepsWithSaleInput(val);
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setRepsWithSale(val);
                        setRepsWithSaleInput(String(val));
                      }}
                      onFocus={(e) => {
                        e.target.select();
                        setRepsWithSaleInput(String(repsWithSale));
                      }}
                      className="w-16 h-8 text-center"
                      placeholder="Current"
                    />
                    <span className="text-muted-foreground">/</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      enterKeyHint="done"
                      value={repsWithSaleGoalInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d+$/.test(val)) {
                          setRepsWithSaleGoalInput(val);
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setRepsWithSaleGoal(val);
                        setRepsWithSaleGoalInput(String(val));
                      }}
                      onFocus={(e) => {
                        e.target.select();
                        setRepsWithSaleGoalInput(String(repsWithSaleGoal));
                      }}
                      className="w-16 h-8 text-center"
                      placeholder="Goal"
                    />
                  </div>
                ) : (
                  <span className="text-lg font-bold">
                    {repsWithSale} / {repsWithSaleGoal}
                  </span>
                )}
              </div>
              <Progress value={repsProgress} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {Math.round(repsProgress)}% towards your recruiting goal
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personal Dashboard Card (conditional) */}
        {dashboardUrl && (
          <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                My Dashboard
              </CardTitle>
              <CardDescription>
                Access your personalized leadership dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => openLink(dashboardUrl)} className="w-full">
                Open Dashboard
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recruiting Flow Carousel */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recruiting Flow</CardTitle>
            <CardDescription>
              Your step-by-step recruiting process
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <RecruitingFlowCarousel />
          </CardContent>
        </Card>

        {/* Unified Blitz Management */}
        {!blitzesLoading && !teamLoading && (
          <div data-blitz-card>
            <VetBlitzCard 
              repData={repData} 
              allBlitzes={allBlitzes}
              teamMembers={teamMembers}
              isTeamLead={isTeamLead}
              onTeamMemberUpdate={(notionPageId, updates) => {
                setTeamMembers(prev => 
                  prev.map(m => 
                    m.notionPageId === notionPageId 
                      ? { ...m, ...updates }
                      : m
                  )
                );
              }}
              onCommitmentChange={handleRefresh}
            />
          </div>
        )}

        {/* 5-5-5 Callout at Bottom */}
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20">
                <Target className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg">5-5-5</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Not sure where to start? Make <span className="font-bold text-primary text-base">5</span> cold contacts every day, try and get <span className="font-bold text-primary text-base">5</span> reps with <span className="font-bold text-primary text-base">5</span> FP+ each before summer.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logout Confirmation Sheet */}
        <Sheet open={logoutSheetOpen} onOpenChange={setLogoutSheetOpen}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Confirm Logout</SheetTitle>
              <SheetDescription>
                Are you sure you want to log out?
              </SheetDescription>
            </SheetHeader>
            <SheetFooter className="flex flex-row gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setLogoutSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={confirmLogout}
              >
                Logout
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Weather Sheet */}
        <Sheet open={weatherSheetOpen} onOpenChange={setWeatherSheetOpen}>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-center">
                {nextBlitz?.location || 'Blitz'} Weather
              </SheetTitle>
            </SheetHeader>
            
            <div className="relative">
              <div className="overflow-x-auto pb-3 scrollbar-hide">
                <div className="flex gap-3 px-1">
                  {weather.map((day) => {
                      // Parse date in UTC to avoid timezone issues
                      const [year, month, dayNum] = day.date.split('-').map(Number);
                      const date = new Date(year, month - 1, dayNum);
                      const hasRain = isRainy(day.weatherCode);
                      
                      return (
                        <div
                          key={day.date}
                          className={`flex-shrink-0 w-20 p-3 rounded-xl bg-secondary/30 border transition-colors text-center ${
                            hasRain ? 'border-blue-400/50 bg-blue-50/5' : 'border-border/50'
                          }`}
                        >
                          <div className="text-xs text-muted-foreground font-semibold mb-1">
                            {date.toLocaleDateString("en-US", { weekday: "short" })}
                          </div>
                          <div className="text-[10px] text-muted-foreground/70 mb-2">
                            {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                          <div className="text-3xl mb-2">{getWeatherIcon(day.weatherCode)}</div>
                          <div className="text-base font-bold">{day.high}°</div>
                          <div className="text-[10px] text-muted-foreground/70">{day.low}°</div>
                        </div>
                      );
                    })}
                </div>
              </div>
              
              {/* Subtle scroll gradient indicators */}
              {weather.length > 4 && (
                <>
                  <div className="absolute left-0 top-0 bottom-3 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-3 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
                </>
              )}
            </div>

            {/* Cold/Rain Warning */}
            {(() => {
              const hasColdDay = weather.some(day => day.high < 65);
              const hasRainDay = weather.some(day => isRainy(day.weatherCode));
              
              return (hasColdDay || hasRainDay) && (
                <div className="mt-3 mb-4">
                  <p className="text-xs text-muted-foreground italic text-center leading-relaxed">
                    Pack warm — it gets colder than you think when you're outside all day. Pants are probably the move not shorts.
                  </p>
                </div>
              );
            })()}

            {/* Packing List Button */}
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tripDate = nextBlitz ? new Date(nextBlitz.date) : null;
              const diffTime = tripDate ? tripDate.getTime() - today.getTime() : 0;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              return diffDays <= 4 && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={() => {
                      const url = "https://calvinschofield.notion.site/Packing-List-Blitz-Trips-63bbc6dd1afd4340a9c9ca5533c838b4";
                      const notionMatch = url.match(/([a-f0-9]{32}|[a-f0-9-]{36})/);
                      if (notionMatch) {
                        const pageId = notionMatch[1].replace(/-/g, '');
                        window.location.href = `notion://${pageId}`;
                        setTimeout(() => {
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }, 500);
                      }
                      setWeatherSheetOpen(false);
                    }}
                    className="w-full"
                    size="lg"
                  >
                    View Packing List
                  </Button>
                </div>
              );
            })()}
          </SheetContent>
        </Sheet>
        
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    </div>
  );
};
