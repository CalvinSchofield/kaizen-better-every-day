import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, LogOut, ExternalLink, Copy, Download, Target, Users, BookOpen, Link as LinkIcon, DollarSign } from "lucide-react";
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

  const firstName = repData.name.split(" ")[0];
  const userEmail = repData.email?.toLowerCase();
  const dashboardUrl = userEmail ? DASHBOARD_MAP[userEmail] : null;

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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">
            👋 Welcome back, {firstName}
          </h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

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

        {/* 5-5-5 Goal Card */}
        <Card className="mb-6 border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              5-5-5 Recruiting Goal
            </CardTitle>
            <CardDescription>
              Your preseason recruiting targets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-primary">5</div>
                <div className="text-sm text-muted-foreground">contacts per day</div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="text-3xl font-bold text-primary">5</div>
                <div className="text-sm text-muted-foreground">reps with 5FP+ before summer starts</div>
              </div>
            </div>
          </CardContent>
        </Card>

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
