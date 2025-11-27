import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, LogOut, ExternalLink, Download, Target, Users, DollarSign, Edit2, TrendingUp, HelpCircle, MessageSquare, Calculator, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { RepData } from "@/hooks/useRepData";
import { RecruitingFlowCarousel } from "@/components/RecruitingFlowCarousel";
import { BlitzCountdown } from "@/components/BlitzCountdown";
import { VetBlitzCommitments } from "@/components/VetBlitzCommitments";
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

export const VetHome = ({ repData, onSync, isSyncing, syncSuccess }: VetHomeProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [isEditingStats, setIsEditingStats] = useState(false);
  
  // Auto-refresh on component mount (when PWA reopens)
  useEffect(() => {
    onSync();
  }, []);
  
  // Local state for editable stats - initialize from repData
  const [personalFP, setPersonalFP] = useState(repData.personal_fp ?? 0);
  const [personalFPGoal, setPersonalFPGoal] = useState(repData.personal_fp_goal ?? 0);
  const [repsWithSale, setRepsWithSale] = useState(repData.reps_with_sale ?? 0);
  const [repsWithSaleGoal, setRepsWithSaleGoal] = useState(repData.reps_with_sale_goal ?? 0);

  // Sync local state with repData changes
  useEffect(() => {
    setPersonalFP(repData.personal_fp ?? 0);
    setPersonalFPGoal(repData.personal_fp_goal ?? 0);
    setRepsWithSale(repData.reps_with_sale ?? 0);
    setRepsWithSaleGoal(repData.reps_with_sale_goal ?? 0);
  }, [repData]);

  const firstName = repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0];
  const userEmail = repData.email?.toLowerCase();
  const dashboardUrl = userEmail ? DASHBOARD_MAP[userEmail] : null;
  
  const personalFPProgress = personalFPGoal > 0 ? (personalFP / personalFPGoal) * 100 : 0;
  const repsProgress = repsWithSaleGoal > 0 ? (repsWithSale / repsWithSaleGoal) * 100 : 0;
  const goalsNotSet = personalFPGoal === 0 || repsWithSaleGoal === 0;

  const saveGoals = async () => {
    try {
      const { error } = await supabase
        .from('reps')
        .update({
          personal_fp: personalFP,
          personal_fp_goal: personalFPGoal,
          reps_with_sale: repsWithSale,
          reps_with_sale_goal: repsWithSaleGoal,
        })
        .eq('id', repData.id);

      if (error) throw error;

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
    await supabase.auth.signOut();
    navigate("/auth");
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
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
                onClick={onSync}
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
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4 pb-32">
        {/* Blitz Countdown - Removed from top */}

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
                <Label className="text-base font-medium">Personal FP+</Label>
                {isEditingStats ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={personalFP}
                      onChange={(e) => setPersonalFP(Number(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-muted-foreground">/</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={personalFPGoal}
                      onChange={(e) => setPersonalFPGoal(Number(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-16 h-8 text-center"
                    />
                  </div>
                ) : (
                  <span className="text-lg font-bold">
                    {personalFP} / {personalFPGoal}
                  </span>
                )}
              </div>
              <Progress value={personalFPProgress} className="h-3 [&>div]:bg-accent" />
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
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={repsWithSale}
                      onChange={(e) => setRepsWithSale(Number(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-muted-foreground">/</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={repsWithSaleGoal}
                      onChange={(e) => setRepsWithSaleGoal(Number(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-16 h-8 text-center"
                    />
                  </div>
                ) : (
                  <span className="text-lg font-bold">
                    {repsWithSale} / {repsWithSaleGoal}
                  </span>
                )}
              </div>
              <Progress value={repsProgress} className="h-3 [&>div]:bg-accent" />
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

        {/* Blitz Commitments */}
        <VetBlitzCommitments repData={repData} />

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
      </div>
    </div>
  );
};
