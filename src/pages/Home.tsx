import { CheckCircle2, Circle, Lock, Loader2, ChevronDown, ChevronRight, RefreshCw, LogOut, MapPin, Wifi, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useRepData } from "@/hooks/useRepData";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import TeamCalendarModal from "@/components/TeamCalendarModal";
import { VetHome } from "@/components/VetHome";
import { PostBlitzRookieHome } from "@/components/PostBlitzRookieHome";
import { BlitzCountdown } from "@/components/BlitzCountdown";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { KnockingModeHome } from "@/components/KnockingModeHome";
import { useAppMode } from "@/hooks/useAppMode";

interface StepStatus {
  completed: boolean;
  locked: boolean;
  inProgress: boolean;
}
interface JourneyStep {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  actions: Array<{
    label: string;
    href?: string;
    variant?: "default" | "outline" | "secondary" | "success" | "warning" | "locked";
    onClick?: () => void;
  }>;
}
interface RampTask {
  id: string;
  label: string;
  href?: string;
  duration?: string;
  onClick?: () => void;
}
interface RampPhase {
  id: number;
  title: string;
  tasks: RampTask[];
}
const Home = () => {
  const {
    repData,
    loading,
    refetch
  } = useRepData();
  
  const { isKnockingMode } = useAppMode(repData);
  
  // Auto-refresh on component mount (when PWA reopens)
  useEffect(() => {
    refetch();
  }, []);
  
  // Fetch next upcoming blitz from committed blitzes stored in Notion
  useEffect(() => {
    if (!repData?.committed_blitzes || !Array.isArray(repData.committed_blitzes) || repData.committed_blitzes.length === 0) {
      setNextBlitz(null);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter to only blitzes that are in the future (check end date if available)
    const committedBlitzes = (repData.committed_blitzes as any[]) || [];
    const upcomingBlitzes = committedBlitzes
      .filter((blitz: any) => {
        if (!blitz || typeof blitz !== 'object' || !blitz.date) return false;
        
        // Use end date if available, otherwise use start date
        const blitzEndDate = blitz.endDate ? new Date(blitz.endDate) : new Date(blitz.date);
        blitzEndDate.setHours(0, 0, 0, 0);
        return blitzEndDate >= today;
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcomingBlitzes.length > 0) {
      const next = upcomingBlitzes[0];
      setNextBlitz({
        name: next.name,
        date: next.date,
        endDate: next.endDate,
        location: next.location,
        address1: next.address1,
        address2: next.address2,
        code1: next.code1,
        code2: next.code2,
        wifi1: next.wifi1,
        wifi2: next.wifi2,
      });
    } else {
      setNextBlitz(null);
    }
  }, [repData]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showIntroDialog, setShowIntroDialog] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const [weather, setWeather] = useState<Array<{ date: string; high: number; low: number; weatherCode: number; precipitation: number }>>([]);
  const [previousProgress, setPreviousProgress] = useState<number>(0);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isNudging, setIsNudging] = useState(false);
  const [nextBlitz, setNextBlitz] = useState<{ 
    name: string; 
    date: string; 
    endDate: string | null; 
    location: string;
    address1?: string | null;
    address2?: string | null;
    code1?: string | null;
    code2?: string | null;
    wifi1?: string | null;
    wifi2?: string | null;
  } | null>(null);

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

  // Get completed tasks from database
  const completedTasksArray = (repData?.completed_tasks as string[]) || [];
  const completedTasks = useMemo(() => new Set(completedTasksArray), [completedTasksArray]);
  
  // Helper to update completed tasks in database
  const setCompletedTasks = async (newSet: Set<string>) => {
    if (!repData?.id) return;
    
    const taskArray = [...newSet];
    console.log('[Home] Updating completed tasks in database:', taskArray);
    
    try {
      const { error } = await supabase
        .from('reps')
        .update({ completed_tasks: taskArray })
        .eq('id', repData.id);
      
      if (error) {
        console.error('[Home] Error updating completed tasks:', error);
        toast({
          title: "Error saving progress",
          description: "Could not save your task progress. Please try again.",
          variant: "destructive",
        });
      } else {
        console.log('[Home] Successfully saved completed tasks to database');
      }
    } catch (error) {
      console.error('[Home] Exception updating completed tasks:', error);
    }
  };

  // Calculate progress values - sequential logic (later steps imply earlier ones are done)
  const phase = repData?.ramp_to_blitz_phase || "Not started";
  const phaseLower = phase.toLowerCase();
  
  // Log for debugging progress
  console.log("Current phase from Notion:", phase);
  console.log("Phase lowercase:", phaseLower);
  
  // Check which phase is marked complete in Notion
  const notionOnboardingComplete = phaseLower.includes("onboarding") && phaseLower.includes("✅");
  const notionTrainingsComplete = phaseLower.includes("training") && phaseLower.includes("✅");
  const notionSlackComplete = phaseLower.includes("slack") && phaseLower.includes("✅");
  const notionPhase1Complete = phaseLower.includes("phase 1") && phaseLower.includes("✅");
  const notionPhase2Complete = phaseLower.includes("phase 2") && phaseLower.includes("✅");
  const notionPhase3Complete = phaseLower.includes("phase 3") && phaseLower.includes("✅");
  const notionPhase4Complete = phaseLower.includes("phase 4") && phaseLower.includes("✅");
  
  // Sequential logic: if a later step is complete, all previous steps must be complete
  const phase4Complete = notionPhase4Complete;
  const phase3Complete = notionPhase3Complete || phase4Complete;
  const phase2Complete = notionPhase2Complete || phase3Complete;
  const phase1Complete = notionPhase1Complete || phase2Complete;
  const slackComplete = notionSlackComplete || phase1Complete;
  const trainingsComplete = notionTrainingsComplete || slackComplete;
  const onboardingComplete = notionOnboardingComplete || trainingsComplete;
  
  const totalSteps = 7;
  const completedSteps = [
    onboardingComplete,
    trainingsComplete,
    slackComplete,
    phase1Complete,
    phase2Complete,
    phase3Complete,
    phase4Complete
  ].filter(Boolean).length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  // Log progress calculation
  console.log("Progress:", {
    onboardingComplete,
    trainingsComplete,
    slackComplete,
    phase1Complete,
    phase2Complete,
    phase3Complete,
    phase4Complete,
    completedSteps,
    totalSteps,
    progressPercentage
  });

  // Define the 4 Ramp to Blitz phases (must be before useEffect that uses it)
  const rampPhases: RampPhase[] = [{
    id: 1,
    title: "Phase 1: Set Goals",
    tasks: [{
      id: "phase1-blitz-video",
      label: "Watch: What is a blitz and how do you get paid?",
      href: "https://calvinschofield.notion.site/What-the-blitz-is-and-how-you-get-paid-c74c25ffd00747e4a345c08160d727e6",
      duration: "5 mins"
    }, {
      id: "phase1-goals-call",
      label: "Text leaders to schedule a Goals & Gameplan call",
      href: "https://www.notion.so/Goals-Gameplan-290070fe3bc280daa182cc832ef1a35d",
      duration: "30 mins"
    }, {
      id: "phase1-calendar",
      label: "Add the Vivint calendar to your phone and make plans to attend your first blitz",
      onClick: () => setCalendarModalOpen(true)
    }]
  }, {
    id: 2,
    title: "Phase 2: Start Trainings",
    tasks: [{
      id: "phase2-product-basics",
      label: "Learn Product basics - How to sound like you've been selling for years",
      href: "https://www.notion.so/Product-How-to-sound-like-you-ve-been-selling-for-years-in-one-night-2d7f4a89e80d4d4686c40da84f6540b7",
      duration: "30 mins"
    }, {
      id: "phase2-product-quiz",
      label: "Take the Product Quiz",
      href: "https://docs.google.com/forms/d/e/1FAIpQLSc9CiA33lB2VXYz9RAGv1IPp1bjn9ypbZ9xMVa1bJ3huHwhSg/viewform?usp=dialog",
      duration: "5 mins"
    }, {
      id: "phase2-upgrades",
      label: "Study Upgrades 101",
      href: "https://www.notion.so/Upgrades-101-f027467a0a5e405a853abdc26e92401e",
      duration: "30 mins"
    }, {
      id: "phase2-takeover",
      label: "Study the Takeover Door Approach",
      href: "https://www.notion.so/Takeover-Door-Approach-18c070fe3bc2800bad33c0818f0f0489",
      duration: "30 mins"
    }, {
      id: "phase2-pitch-video",
      label: "Send video giving the two pitches to your leaders",
      href: "https://www.notion.so/Pitch-Feedback-Instructions-03901d3e606b4aa29fbc5f5b20de8a8e",
      duration: "5 mins"
    }]
  }, {
    id: 3,
    title: "Phase 3: Practice",
    tasks: [{
      id: "phase3-ipad-setup",
      label: "Get your iPad ready - Tools to Sell guide",
      href: "https://www.notion.so/Tools-to-Sell-iPad-setup-guide-112cda9d37034831bed0dafbc12364f1",
      duration: "30 mins"
    }, {
      id: "phase3-why-blitz",
      label: "Write down: Why am I going on the blitz? And send it to your leaders",
      duration: "5 mins",
      onClick: () => window.open("sms:", "_self")
    }, {
      id: "phase3-pitch-practice",
      label: "1-on-1 pitch practice with a vet - text your leaders to set up",
      duration: "20 mins",
      onClick: () => window.open("sms:", "_self")
    }]
  }, {
    id: 4,
    title: "Phase 4: Saddle Up!",
    tasks: [{
      id: "phase4-packing-list",
      label: "Review the Packing List - Blitz Trips",
      href: "https://www.notion.so/Packing-List-Blitz-Trips-63bbc6dd1afd4340a9c9ca5533c838b4"
    }, {
      id: "phase4-dominate-video",
      label: "Watch: How to Dominate Your First Blitz",
      href: "https://www.notion.so/How-to-Dominate-Your-First-Blitz-23f9a08a052548e8b838f80837c9e35d",
      duration: "5 mins"
    }, {
      id: "phase4-equipment",
      label: "Text leadership for iPad, badge, and knocking jerseys",
      onClick: () => window.open("sms:", "_self")
    }, {
      id: "phase4-playbook",
      label: "Share with leaders: When It Gets Tough - Your Playbook",
      href: "https://www.notion.so/When-It-Gets-Tough-Your-Playbook-d6d63908789b4b7587b861bd5b382f71",
      duration: "10 mins"
    }]
  }];

  // Determine phase status
  const getPhaseStatus = (phaseId: number) => {
    if (phaseId === 1) {
      return {
        completed: phase1Complete,
        locked: !slackComplete,
        inProgress: slackComplete && !phase1Complete
      };
    } else if (phaseId === 2) {
      return {
        completed: phase2Complete,
        locked: !phase1Complete,
        inProgress: phase1Complete && !phase2Complete
      };
    } else if (phaseId === 3) {
      return {
        completed: phase3Complete,
        locked: !phase2Complete,
        inProgress: phase2Complete && !phase3Complete
      };
    } else if (phaseId === 4) {
      return {
        completed: phase4Complete,
        locked: !phase3Complete,
        inProgress: phase3Complete && !phase4Complete
      };
    }
    return {
      completed: false,
      locked: true,
      inProgress: false
    };
  };

  // Handler for task clicks - toggle check and open link only when checking
  const handleTaskClick = async (taskId: string, href?: string, onClick?: () => void) => {
    const newCompleted = new Set(completedTasks);
    const isCurrentlyCompleted = completedTasks.has(taskId);
    
    if (isCurrentlyCompleted) {
      // Uncheck - remove from set, don't open link
      newCompleted.delete(taskId);
    } else {
      // Check - add to set and execute action
      newCompleted.add(taskId);

      // Execute action only when checking off
      if (onClick) {
        onClick();
      } else if (href) {
        openLink(href);
      }
    }
    
    await setCompletedTasks(newCompleted);
  };

  // Smart link opener - tries to open in native apps when possible
  const openLink = (url: string) => {
    // Check if it's a Notion link and try to open in Notion app
    if (url.includes('notion.so') || url.includes('notion.site')) {
      // Extract page ID from URL and construct notion:// deep link
      const notionMatch = url.match(/([a-f0-9]{32}|[a-f0-9-]{36})/);
      if (notionMatch) {
        const pageId = notionMatch[1].replace(/-/g, '');
        const notionAppUrl = `notion://${pageId}`;
        
        // Try to open in Notion app, fallback to browser
        window.location.href = notionAppUrl;
        
        // Fallback to web after short delay if app doesn't open
        setTimeout(() => {
          window.open(url, '_blank', 'noopener,noreferrer');
        }, 500);
        return;
      }
    }
    
    // Open other links in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Auto-complete tasks when phase is marked complete in Notion
  useEffect(() => {
    if (!repData?.id) return;
    
    const newCompleted = new Set(completedTasks);
    let hasChanges = false;
    
    // Auto-complete all tasks in completed phases
    rampPhases.forEach((phase) => {
      const phaseStatus = getPhaseStatus(phase.id);
      if (phaseStatus.completed) {
        phase.tasks.forEach((task) => {
          if (!newCompleted.has(task.id)) {
            newCompleted.add(task.id);
            hasChanges = true;
          }
        });
      }
    });
    
    if (hasChanges) {
      setCompletedTasks(newCompleted);
    }
  }, [phase1Complete, phase2Complete, phase3Complete, phase4Complete, repData?.id, completedTasks]);

  // Track progress changes and trigger celebrations (only when moving forward)
  useEffect(() => {
    // Only celebrate when moving forward AND not on initial load
    if (completedSteps > previousProgress && previousProgress > 0) {
      setAnimateProgress(true);
      
      // Trigger haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]); // Double vibration pattern
      }
      
      // Trigger confetti only when progressing forward
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF6B35', '#F7931E', '#FDC830', '#4CAF50']
      });
      
      const stepNames = [
        "Onboarding",
        "Trainings",
        "Slack Introduction",
        "Phase 1: Set Goals",
        "Phase 2: Start Trainings",
        "Phase 3: Practice",
        "Phase 4: Saddle Up!"
      ];
      
      toast({
        title: "🎉 Step Complete!",
        description: `Great job completing ${stepNames[completedSteps - 1]}! Keep going!`,
        duration: 4000,
      });

      setTimeout(() => setAnimateProgress(false), 1000);
    }
    
    // Always update previous progress to track changes in both directions
    if (previousProgress !== completedSteps) {
      setPreviousProgress(completedSteps);
    }
  }, [completedSteps, previousProgress, toast]);

  // Fetch weather for upcoming blitzes (within 7 days)
  useEffect(() => {
    const fetchWeather = async () => {
      if (!nextBlitz || !nextBlitz.location || !nextBlitz.date || !nextBlitz.endDate) {
        setWeather([]);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tripDate = new Date(nextBlitz.date);
      tripDate.setHours(0, 0, 0, 0);
      const diffTime = tripDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Only fetch weather if blitz is within 8 days and in the future
      if (diffDays <= 0 || diffDays > 8) {
        setWeather([]);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("get-blitz-weather", {
          body: {
            location: nextBlitz.location,
            startDate: nextBlitz.date,
            endDate: nextBlitz.endDate,
          },
        });

        if (!error && data?.forecasts) {
          console.log('[Weather] Received forecasts:', data.forecasts);
          console.log('[Weather] Start date:', nextBlitz.date, 'End date:', nextBlitz.endDate);
          setWeather(data.forecasts); // Show all working days
        }
      } catch (error) {
        console.error("Error fetching weather:", error);
      }
    };

    fetchWeather();
  }, [nextBlitz]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        toast({
          title: "Logout failed",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always navigate to auth page, even if signOut had an error
      navigate("/auth", { replace: true });
    }
  };

  const confirmLogout = () => {
    setLogoutSheetOpen(false);
    handleLogout();
  };

  const openInMaps = (address: string) => {
    if (!address) return;
    
    const encodedAddress = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
      window.location.href = `maps://maps.apple.com/?q=${encodedAddress}`;
    } else if (isAndroid) {
      window.location.href = `geo:0,0?q=${encodedAddress}`;
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  const copyToClipboard = async (text: string, successMessage: string) => {
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: successMessage,
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      await refetch();
      // Show success animation instead of toast
      setSyncSuccess(true);
      setTimeout(() => {
        setSyncSuccess(false);
      }, 2500);
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Could not sync your data. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const { containerRef, pullDistance } = usePullToRefresh({
    onRefresh: handleSync,
    isRefreshing: isSyncing,
    threshold: 80,
  });

  const handleSetupNudge = async () => {
    setIsNudging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No user email found');

      const { error } = await supabase.functions.invoke('send-setup-nudge-email', {
        body: {
          userEmail: user.email,
          notionEmail: repData?.email || null,
          repName: repData?.name || user.user_metadata?.name || null,
        }
      });
      
      if (error) throw error;

      toast({
        title: "Leaders Notified!",
        description: "Your leadership team has been notified to help set up your account.",
      });
    } catch (error: any) {
      console.error('Setup nudge error:', error);
      toast({
        title: "Error",
        description: "Could not notify leaders. Please try texting them directly.",
        variant: "destructive",
      });
    } finally {
      setIsNudging(false);
    }
  };

  const handleNudge = async () => {
    if (!repData?.id) return;
    
    setIsNudging(true);
    try {
      const newNudgeValue = !repData.nudge_leader;
      
      console.log('[Nudge] Calling edge function to update Notion:', { newValue: newNudgeValue });
      
      // Call edge function to update Notion
      const { data, error } = await supabase.functions.invoke('update-notion-nudge', {
        body: { nudgeValue: newNudgeValue }
      });
      
      if (error) {
        console.error('[Nudge] Edge function error:', error);
        throw error;
      }
      
      console.log('[Nudge] Edge function response:', data);
      
      toast({
        title: "✓ Leaders notified!",
        description: "Your leaders have been notified in Notion that you've completed all tasks.",
        duration: 3000,
      });
    } catch (error) {
      console.error('[Nudge] Exception:', error);
      toast({
        title: "Nudge failed",
        description: "Could not update Notion. Check console for details.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsNudging(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }

  // Check if user has no rep data (email doesn't match Notion)
  if (!repData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
        <div className="bg-primary text-primary-foreground p-6 pb-8">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">Welcome to Kaizen</h1>
              <Button 
                onClick={() => setLogoutSheetOpen(true)} 
                variant="ghost" 
                size="sm" 
                className="text-primary-foreground hover:bg-primary-foreground/10"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 -mt-4 pb-6">
          <Card className="border-warning/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>⚠️</span>
                Account Setup Needed
              </CardTitle>
              <CardDescription>
                Looks like the email we have for you is different than the one you used to sign in. We'll correct it, just let us know and we'll fix it ASAP.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleSetupNudge}
                className="w-full"
                disabled={isNudging}
              >
                {isNudging ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request access"}
              </Button>
              <Button
                onClick={handleSync}
                variant="outline"
                className={`w-full transition-all duration-300 ${
                  syncSuccess 
                    ? 'bg-green-500 text-white border-green-500 hover:bg-green-500' 
                    : ''
                }`}
                disabled={isSyncing}
              >
                {syncSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 animate-scale-in" />
                    Synced!
                  </>
                ) : isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Logout Confirmation Sheet */}
        <Sheet open={logoutSheetOpen} onOpenChange={setLogoutSheetOpen}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Are you sure you want to log out?</SheetTitle>
              <SheetDescription>
                You'll need to sign back in to access your journey progress and training.
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
                Log Out
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  }
  
  // Check if rookie has completed Ramp to Blitz AND attended at least one blitz
  const committedBlitzes = (repData.committed_blitzes as any[]) || [];
  const hasAttendedBlitz = committedBlitzes.some((blitz: any) => {
    if (!blitz?.endDate) return false;
    const endDate = new Date(blitz.endDate);
    return endDate < new Date(); // End date is in the past
  });
  
  // Check if knocking mode is active - route to KnockingModeHome
  if (isKnockingMode) {
    const year = repData.year || "Rookie";
    const isVetOrSoph = year === "Vet" || year === "Sophomore";
    const isPostBlitzRookie = year === "Rookie" && phase4Complete && hasAttendedBlitz;
    
    // TODO: Add team lead detection logic
    const isTeamLead = false;
    const anyBlitzWithin14Days = false;
    
    if (isVetOrSoph || isPostBlitzRookie) {
      return (
        <KnockingModeHome
          variant={isVetOrSoph ? "vet" : "rookie"}
          repData={repData}
          onSync={handleSync}
          isSyncing={isSyncing}
          syncSuccess={syncSuccess}
          isTeamLead={isTeamLead}
          anyBlitzWithin14Days={anyBlitzWithin14Days}
        />
      );
    }
  }
  
  // Check if user is a Vet or Sophomore - show VetHome instead
  if (repData.year === "Vet" || repData.year === "Sophomore") {
    return <VetHome repData={repData} onSync={handleSync} isSyncing={isSyncing} syncSuccess={syncSuccess} />;
  }

  if (repData.year === "Rookie" && phase4Complete && hasAttendedBlitz) {
    return <PostBlitzRookieHome repData={repData} onSync={handleSync} isSyncing={isSyncing} syncSuccess={syncSuccess} />;
  }
  
  // Helper to check phase status - case-insensitive matching
  const isInRampPhases = phase1Complete || phase2Complete || phase3Complete || phase4Complete || slackComplete;
  const allRampPhasesComplete = phase4Complete;
  const steps: JourneyStep[] = [{
    id: "onboarding",
    title: "Complete Your Onboarding",
    description: "Get fully onboarded in the system so you can get paid and start training.",
    status: {
      completed: onboardingComplete || trainingsComplete || slackComplete || isInRampPhases,
      locked: false,
      inProgress: phaseLower === "not started" && !onboardingComplete
    },
    actions: [{
      label: "Finish Onboarding",
      href: "https://onboardingtool.vivint.com/",
      variant: "default"
    }, {
      label: "Request I-9 Help",
      href: "https://forms.gle/rCssbYULxJ673nfP8",
      variant: "outline"
    }]
  }, {
    id: "trainings",
    title: "Complete Required Vivint Trainings",
    description: "Finish the mandatory Vivint modules and quizzes so you're cleared to sell.",
    status: {
      completed: trainingsComplete || slackComplete || isInRampPhases,
      locked: !(onboardingComplete || trainingsComplete || slackComplete || isInRampPhases),
      inProgress: onboardingComplete && !trainingsComplete && !slackComplete && !isInRampPhases
    },
    actions: [{
      label: "Open Training Portal",
      href: "https://dthvivinttraining.conveyour.com/ui/portal"
    }]
  }, {
    id: "slack",
    title: "Join the Team Slack & Introduce Yourself",
    description: "Join the group and post a quick intro so the team knows who you are.",
    status: {
      completed: slackComplete || isInRampPhases,
      locked: !(trainingsComplete || slackComplete || isInRampPhases),
      inProgress: trainingsComplete && !slackComplete && !isInRampPhases
    },
    actions: [{
      label: "Join Slack",
      href: "https://join.slack.com/t/vivint-chy4678/shared_invite/zt-3g30ikq9e-RugmfMRBUCu4qx5S0GUgZw"
    }, {
      label: "Intro Example",
      variant: "outline",
      onClick: () => setShowIntroDialog(true)
    }]
  }];

  const getStatusBadge = (status: StepStatus) => {
    if (status.completed) {
      return <Badge className="bg-success text-success-foreground">✓ Completed</Badge>;
    }
    if (status.inProgress) {
      return <Badge className="bg-warning text-warning-foreground">In Progress</Badge>;
    }
    if (status.locked) {
      return <Badge className="bg-locked text-locked-foreground">🔒 Locked</Badge>;
    }
    return <Badge variant="outline">Not Started</Badge>;
  };
  const getStatusIcon = (status: StepStatus) => {
    if (status.completed) {
      return <CheckCircle2 className="w-6 h-6 text-success" />;
    }
    if (status.locked) {
      return <Lock className="w-6 h-6 text-locked" />;
    }
    return <Circle className="w-6 h-6 text-muted-foreground" />;
  };

  return <div ref={containerRef} className="min-h-screen bg-gradient-to-b from-background to-secondary/30 overflow-y-auto">
      {/* Pull to refresh hint */}
      <div 
        className="fixed top-0 left-0 right-0 flex justify-center pt-2 z-50 transition-opacity duration-200 pointer-events-none"
        style={{ opacity: pullDistance > 0 ? Math.min(pullDistance / 80, 0.6) : 0 }}
      >
        <p className="text-xs text-muted-foreground">Pull down to refresh</p>
      </div>
      
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 pb-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              {!onboardingComplete || !trainingsComplete ? (
                <h1 className="text-3xl font-bold tracking-tight">👋 Welcome back, {repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0]}</h1>
              ) : (
                <>
                  {(() => {
                    const firstName = repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0];
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
                </>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0 self-start">
              <Button 
                onClick={() => setLogoutSheetOpen(true)}
                variant="ghost" 
                size="sm"
                className="rounded-full text-primary-foreground hover:bg-primary-foreground/10"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Subtitle for pre-onboarding */}
          {(!onboardingComplete || !trainingsComplete) && (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Check if next blitz is upcoming and within 7 days
            const hasUpcomingBlitz = nextBlitz !== null;
            const diffTime = hasUpcomingBlitz ? new Date(nextBlitz.date).getTime() - today.getTime() : 0;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Urgent message if blitz is within 7 days and onboarding incomplete
            if (hasUpcomingBlitz && diffDays <= 7) {
              const blitzLocation = nextBlitz.location?.split(',')[0] || 'your';
              return (
                <p className="text-orange-600 dark:text-orange-400 text-base font-bold mb-3">
                  Reminder — to go on the {blitzLocation} blitz you have to finish all these steps first.
                </p>
              );
            }
            
            // Normal message
            return (
              <p className="text-primary-foreground/90 text-base font-medium mb-3">
                The basics to make your first $10k at Vivint
              </p>
            );
          })()}

          {/* CTA Button - full width */}
          {(onboardingComplete && trainingsComplete) && (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Check if it's Monday between 4 AM - 8:30 PM MST
            const now = new Date();
            const mstOffset = -7 * 60; // MST is UTC-7
            const mstTime = new Date(now.getTime() + (now.getTimezoneOffset() + mstOffset) * 60000);
            const mstHour = mstTime.getHours();
            const mstDay = mstTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const isMondayNightLights = mstDay === 1 && mstHour >= 4 && mstHour < 20.5; // 4 AM to 8:30 PM
            
            // Check if we're currently during a blitz week
            const isBlitzWeek = nextBlitz && (() => {
              const startDate = new Date(nextBlitz.date);
              startDate.setHours(0, 0, 0, 0);
              const endDate = nextBlitz.endDate ? new Date(nextBlitz.endDate) : new Date(nextBlitz.date);
              endDate.setHours(23, 59, 59, 999);
              const checkDate = new Date();
              checkDate.setHours(0, 0, 0, 0);
              return checkDate >= startDate && checkDate <= endDate;
            })();
            
            // Show blitz week message if during blitz
            if (isBlitzWeek) {
              return (
                <div className="px-6 py-4 rounded-lg bg-primary-foreground/10 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">⚡</span>
                    <h3 className="text-primary-foreground font-bold text-lg">You're on the Blitz!</h3>
                  </div>
                  <p className="text-primary-foreground/90 text-sm leading-relaxed">
                    Good luck! The goal is forward progress. Selling is a by product of you focusing on the inputs.
                  </p>
                </div>
              );
            }
            
            if (isMondayNightLights) {
              return (
                <div className="px-6 py-4 rounded-lg bg-primary-foreground/10 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🌙</span>
                    <h3 className="text-primary-foreground font-bold text-lg">Monday Night Lights — Tonight!</h3>
                  </div>
                  <p className="text-primary-foreground/90 text-sm leading-relaxed mb-3">
                    Join us for training, Q&A, and team connection. Attend online or in person in Lehi if you can make it!
                  </p>
                  <Button 
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open('https://calvinschofield.notion.site/Monday-Night-Lights-15c1f9c4ddcd80e192a2fb0f4d533b55', '_blank')}
                  >
                    View Details
                  </Button>
                </div>
              );
            }
            
            // Find next upcoming blitz (not past ones)
            const hasValidBlitz = nextBlitz !== null;
            
            let ctaText = "";
            let ctaIcon = "";
            
            if (!hasValidBlitz) {
              ctaText = "Pick a blitz trip and commit to making your first sale";
              ctaIcon = "📅";
            } else {
              const tripDate = new Date(nextBlitz.date);
              const diffTime = tripDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays === 0) {
                ctaText = `${nextBlitz.location || 'Your blitz'} today — you got this!`;
                ctaIcon = "🔥";
              } else if (diffDays === 1) {
                ctaText = `1 day until ${nextBlitz.location || 'your blitz'} — prep makes perfect`;
                ctaIcon = "⚡";
              } else if (diffDays <= 8) {
                ctaText = `${diffDays} days until ${nextBlitz.location || 'your blitz'} — prep makes perfect`;
                ctaIcon = "⚡";
              } else {
                ctaText = `${nextBlitz.location || 'Your blitz'} in ${diffDays} days — stay sharp and keep training! Focus on role plays with leaders`;
                ctaIcon = "🎯";
              }
            }
            
            const showWeather = weather.length > 0 && hasValidBlitz;
            const weatherDiffDays = nextBlitz ? Math.ceil((new Date(nextBlitz.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
            
            // Check if user is currently within the blitz date range
            const blitzStart = nextBlitz ? new Date(nextBlitz.date) : null;
            if (blitzStart) blitzStart.setHours(0, 0, 0, 0);
            const blitzEnd = nextBlitz?.endDate ? new Date(nextBlitz.endDate) : blitzStart;
            if (blitzEnd) blitzEnd.setHours(23, 59, 59, 999);
            const isWithinBlitz = hasValidBlitz && blitzStart && blitzEnd && today >= blitzStart && today <= blitzEnd;
            
            // Show Airbnb actions when within blitz date range
            if (isWithinBlitz) {
              // Only show action buttons if at least one field is available
              const hasAirbnbData = nextBlitz.address1 || nextBlitz.wifi1 || nextBlitz.code1;
              
              return (
                <div className="flex flex-col gap-2 w-full px-6 py-3 rounded-lg bg-primary-foreground/10 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{ctaIcon}</span>
                    <p className="text-primary-foreground/90 text-base font-medium leading-snug flex-1">
                      {weatherDiffDays === 0 ? ctaText : `${nextBlitz.location} this week — you got this!`}
                    </p>
                  </div>
                  
                  {/* Airbnb Action Buttons - pill style inside card */}
                  {hasAirbnbData && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {nextBlitz.address1 && (
                        <button 
                          onClick={() => openInMaps(nextBlitz.address1!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/50 hover:bg-background/70 transition-all text-sm"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>Map</span>
                        </button>
                      )}
                      
                      {nextBlitz.wifi1 && (
                        <button 
                          onClick={() => copyToClipboard(nextBlitz.wifi1!, 'WiFi password copied!')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/50 hover:bg-background/70 transition-all text-sm"
                        >
                          <Wifi className="w-4 h-4" />
                          <span>Password</span>
                        </button>
                      )}
                      
                      {nextBlitz.code1 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/50 text-sm">
                          <Key className="w-4 h-4" />
                          <span className="font-mono">{nextBlitz.code1}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            
            // Only clickable if no blitz OR blitz is within 8 days (but not today)
            const isClickable = !hasValidBlitz || (weatherDiffDays > 0 && weatherDiffDays <= 8);
            
            const handleCtaClick = () => {
              if (!isClickable) return;
              
              if (!hasValidBlitz) {
                setCalendarModalOpen(true);
              } else {
                setWeatherSheetOpen(true);
              }
            };
            
            // If not clickable (blitz is far away), show plain text
            if (!isClickable) {
              return (
                <div className="flex items-center gap-3 mb-3 px-2">
                  <span className="text-2xl flex-shrink-0">{ctaIcon}</span>
                  <p className="text-primary-foreground/70 text-base font-medium leading-snug flex-1">
                    {ctaText}
                  </p>
                </div>
              );
            }
            
            // Otherwise show clickable button
            return (
              <button
                onClick={handleCtaClick}
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
          
          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-primary-foreground/70 font-medium">Overall Progress</span>
              <span className="text-sm text-primary-foreground font-semibold">{completedSteps}/{totalSteps}</span>
            </div>
            <Progress 
              value={progressPercentage} 
              className={`h-2 bg-primary-foreground/20 transition-all duration-700 ease-out ${animateProgress ? 'animate-pulse' : ''}`}
            />
            <style>{`
              [data-state="complete"] .progress-indicator {
                background: hsl(var(--primary-foreground)) !important;
              }
            `}</style>
          </div>
        </div>
      </div>

      {/* Journey Steps */}
      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4 pb-6">
        {steps.map(step => {
        const isExpanded = step.status.inProgress && !step.status.completed;
        return <Card key={step.id} className={`transition-all ${step.status.locked ? "opacity-60" : step.status.completed ? "border-success/50" : step.status.inProgress ? "border-primary shadow-orange" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">{getStatusIcon(step.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <CardTitle className="text-lg leading-tight flex-1 min-w-0">{step.title}</CardTitle>
                      {getStatusBadge(step.status)}
                    </div>
                    {isExpanded && <CardDescription className="text-sm leading-relaxed">
                        {step.description}
                      </CardDescription>}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && <CardContent className="pt-0 space-y-2">
                  {step.actions.map((action, actionIndex) => {
                    if (action.href && !action.onClick) {
                      return (
                        <Button 
                          key={actionIndex} 
                          variant={action.variant || "default"} 
                          className="w-full" 
                          size="lg" 
                          disabled={step.status.locked}
                          onClick={() => openLink(action.href!)}
                        >
                          {action.label}
                        </Button>
                      );
                    }
                    return (
                      <Button 
                        key={actionIndex} 
                        variant={action.variant || "default"} 
                        className="w-full" 
                        size="lg" 
                        disabled={step.status.locked} 
                        onClick={action.onClick}
                      >
                        {action.label}
                      </Button>
                    );
                  })}
                </CardContent>}

              {step.status.completed && !isExpanded && <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">Step completed!</p>
                </CardContent>}
            </Card>;
      })}

        {/* Ramp to Blitz Card with Sub-Phases */}
        <Card className={`transition-all ${!slackComplete ? "opacity-60" : allRampPhasesComplete ? "border-success/50" : "border-primary shadow-orange"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {allRampPhasesComplete ? <CheckCircle2 className="w-6 h-6 text-success" /> : !slackComplete ? <Lock className="w-6 h-6 text-locked" /> : <Circle className="w-6 h-6 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <CardTitle className="text-lg leading-tight flex-1 min-w-0">Ramp to Blitz</CardTitle>
                  {allRampPhasesComplete ? <Badge className="bg-success text-success-foreground">✓ Completed</Badge> : !slackComplete ? <Badge className="bg-locked text-locked-foreground">🔒 Locked</Badge> : <Badge className="bg-warning text-warning-foreground">In Progress</Badge>}
                </div>
                {slackComplete && !allRampPhasesComplete && <CardDescription className="text-sm leading-relaxed">
                    Work through all 4 phases to be ready for your first blitz.
                  </CardDescription>}
              </div>
            </div>
          </CardHeader>

          {slackComplete && !allRampPhasesComplete && <CardContent className="pt-0 space-y-3">
              <Accordion 
                type="single" 
                collapsible 
                className="space-y-3"
                defaultValue={
                  phase4Complete ? undefined :
                  phase3Complete ? "phase-4" :
                  phase2Complete ? "phase-3" :
                  phase1Complete ? "phase-2" :
                  slackComplete ? "phase-1" :
                  undefined
                }
              >
                {rampPhases.map(phase => {
                  const phaseStatus = getPhaseStatus(phase.id);
                  
                  // Locked phases cannot be expanded
                  if (phaseStatus.locked) {
                    return (
                      <div key={phase.id} className="border rounded-lg opacity-60 bg-muted/30">
                        <div className="flex items-center justify-between w-full p-4 rounded-lg cursor-not-allowed">
                          <div className="flex items-center gap-3 flex-1">
                            <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex items-center gap-2 flex-wrap flex-1">
                              <span className="font-semibold text-sm">{phase.title}</span>
                              <Badge variant="outline" className="text-xs">🔒 Locked</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <AccordionItem key={phase.id} value={`phase-${phase.id}`} className={`border rounded-lg ${phaseStatus.completed ? "bg-success/5 border-success/30" : "bg-card"}`}>
                      <AccordionTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors rounded-lg [&[data-state=open]>svg]:rotate-180">
                        <div className="flex items-center gap-3 flex-1">
                          {phaseStatus.completed ? <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <span className="font-semibold text-sm">{phase.title}</span>
                            {phaseStatus.completed && <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">✓ Complete</Badge>}
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-4 pb-4 space-y-2">
                        {phase.tasks.map(task => {
                          const isCompleted = completedTasks.has(task.id);
                          return (
                            <div key={task.id} className="flex items-start gap-3 py-2 group">
                              <Checkbox 
                                checked={isCompleted} 
                                onCheckedChange={() => handleTaskClick(task.id, task.href, task.onClick)} 
                                className="mt-0.5 flex-shrink-0" 
                              />
                              <button 
                                onClick={() => handleTaskClick(task.id, task.href, task.onClick)} 
                                className="flex-1 text-left text-sm group-hover:text-primary transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={isCompleted ? "line-through text-muted-foreground" : ""}>
                                    {task.label}
                                  </span>
                                  {task.duration && <span className="text-xs text-muted-foreground">({task.duration})</span>}
                                </div>
                              </button>
                            </div>
                          );
                        })}
                        
                        {/* Show encouragement when all tasks are completed */}
                        {phase.tasks.every(task => completedTasks.has(task.id)) && !phaseStatus.completed && (
                          <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg space-y-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                🎉 Great work! You've completed all tasks for Phase {phase.id}.
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Text your leaders to let them know you're done with Phase {phase.id} so they can verify and unlock the next phase!
                              </p>
                            </div>
                            <Button
                              onClick={handleNudge}
                              disabled={isNudging}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              <span className="mr-2">🫵</span>
                              {isNudging ? "Nudging..." : "Nudge"}
                            </Button>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>}

          {allRampPhasesComplete && <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">All phases completed! You're ready for the blitz!</p>
            </CardContent>}
        </Card>
      </div>

      {/* Intro Example Sheet */}
      <Sheet open={showIntroDialog} onOpenChange={setShowIntroDialog}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Team Introduction Example</SheetTitle>
            <SheetDescription>
              Here's what to share when you introduce yourself to the team:
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 text-sm mt-4">
            <div>
              <h4 className="font-semibold mb-1">Share 1-2 things about yourself:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>What do you like to do in your free time?</li>
                <li>Where are you from?</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Tell us why you're excited:</h4>
              <p className="text-muted-foreground">Share why you're excited to work at Vivint and what you're looking forward to!</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Team Calendar Modal */}
      <TeamCalendarModal 
        open={calendarModalOpen} 
        onOpenChange={setCalendarModalOpen} 
        teamLeaderPhone={repData?.team_leader_phone || undefined}
      />

      {/* Weather Details Sheet */}
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
                    openLink("https://calvinschofield.notion.site/Packing-List-Blitz-Trips-63bbc6dd1afd4340a9c9ca5533c838b4");
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
    </div>;
};
export default Home;