import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, LogOut, ExternalLink, Copy, Download, Target, Users, BookOpen, Link as LinkIcon, DollarSign, Edit2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { RepData } from "@/hooks/useRepData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VetHomeProps {
  repData: RepData;
  onSync: () => void;
  isSyncing: boolean;
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

// Quick share links
const QUICK_LINKS = [
  { label: "SmartHomePros", url: "https://www.smarthomepros.com/?inviteId=fdb85236-b069-46ec-9db6-797d24dfbe10#culture" },
  { label: "Recruiting Content", url: "https://calvinschofield.notion.site/recruiting-content-flow?source=copy_link" },
  { label: "Welcome", url: "https://calvinschofield.notion.site/welcome?source=copy_link" },
  { label: "Ramp to Blitz", url: "https://calvinschofield.notion.site/ramp-to-blitz-program?source=copy_link" },
  { label: "Goals & Gameplan", url: "https://calvinschofield.notion.site/goals-and-gameplan?source=copy_link" },
  { label: "Preseason Trips", url: "https://calvinschofield.notion.site/preseason-trips?v=a85a815c7d1a42fd84d87b9b632582bc&source=copy_link" },
  { label: "Path to Pro", url: "https://calvinschofield.notion.site/path-to-pro?source=copy_link" },
];

// Pay scale documents
const PAY_SCALES = [
  { label: "Leader Pay Scale", file: "/documents/2025_Leader_Payscale.pdf" },
  { label: "Recruiter Pay Scale", file: "/documents/2025_Recruiter_Pay_Scale.pdf" },
  { label: "Sales Rep Pay Scale", file: "/documents/2025_Sales_Rep_Payscale.pdf" },
  { label: "Sales Rules", file: "/documents/2025_Sales_Rules.pdf" },
];

export const VetHome = ({ repData, onSync, isSyncing }: VetHomeProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isEditingStats, setIsEditingStats] = useState(false);
  
  // Local state for editable stats
  const [personalFP, setPersonalFP] = useState(12);
  const [personalFPGoal, setPersonalFPGoal] = useState(50);
  const [repsWithSale, setRepsWithSale] = useState(3);
  const [repsWithSaleGoal, setRepsWithSaleGoal] = useState(5);

  const firstName = repData.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim().split(' ')[0];
  const userEmail = repData.email?.toLowerCase();
  const dashboardUrl = userEmail ? DASHBOARD_MAP[userEmail] : null;
  
  const personalFPProgress = (personalFP / personalFPGoal) * 100;
  const repsProgress = (repsWithSale / repsWithSaleGoal) * 100;

  const handleLogout = () => {
    setLogoutDialogOpen(true);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Header with colored background */}
      <div className="bg-primary text-primary-foreground p-6 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold">Your Dashboard</h1>
              <p className="text-primary-foreground/90 text-sm">
                Welcome back, {firstName}!
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSync}
                disabled={isSyncing}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4 pb-32">
        {/* Status Dashboard Card */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Your Progress</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingStats(!isEditingStats)}
              >
                <Edit2 className="h-4 w-4 mr-1.5" />
                {isEditingStats ? "Done" : "Edit"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <Progress value={personalFPProgress} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {Math.round(personalFPProgress)}% towards your personal sales goal
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


        {/* Recruiting Flow Visual */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Recruiting Flow
            </CardTitle>
            <CardDescription>
              Your step-by-step recruiting process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <img
                src="/images/recruiting-flow.jpeg"
                alt="Recruiting Flow"
                className="w-full h-auto rounded-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Recruiting Hub */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recruiting Hub
            </CardTitle>
            <CardDescription>
              Resources and content for recruiting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => openLink("https://calvinschofield.notion.site/recruiting-content-flow?source=copy_link")}
            >
              <span>Recruiting Content Flow</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              disabled
            >
              <span>Cold Contact Video</span>
              <span className="text-xs text-muted-foreground">Coming Soon</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              disabled
            >
              <span>Recruiting 101</span>
              <span className="text-xs text-muted-foreground">Coming Soon</span>
            </Button>
          </CardContent>
        </Card>

        {/* Quick Share Links */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Quick Share Links
            </CardTitle>
            <CardDescription>
              Copy and share these links with your reps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {QUICK_LINKS.map((link) => (
                <Button
                  key={link.label}
                  variant="outline"
                  className="justify-between"
                  onClick={() => copyToClipboard(link.url, link.label)}
                >
                  <span className="truncate">{link.label}</span>
                  <Copy className="h-4 w-4 ml-2 flex-shrink-0" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pay Scales & Resources */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pay Scales & Resources
            </CardTitle>
            <CardDescription>
              Download pay scales and access additional resources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PAY_SCALES.map((doc) => (
                <Button
                  key={doc.label}
                  variant="outline"
                  className="justify-between"
                  onClick={() => window.open(doc.file, "_blank")}
                >
                  <span className="truncate">{doc.label}</span>
                  <Download className="h-4 w-4 ml-2 flex-shrink-0" />
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full justify-between mt-4"
              onClick={() => openLink("https://calvinschofield.notion.site/the-vault?pvs=4")}
            >
              <span>The Vault</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* 5-5-5 Callout at Bottom */}
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20">
                <Target className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg">5-5-5</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Not sure where to start? Make <span className="font-bold text-primary text-base">5</span> cold contacts every day, try and get <span className="font-bold text-primary text-base">5</span> reps with <span className="font-bold text-primary text-base">5</span> FP+ or more before summer.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logout Confirmation Dialog */}
        <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmLogout}>Logout</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
