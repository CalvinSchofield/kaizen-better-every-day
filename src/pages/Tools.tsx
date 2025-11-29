import { useState } from "react";
import { Wrench, DollarSign, BarChart3, Users, FileText, Phone, HelpCircle, Calendar, ExternalLink, Shield, TrendingUp, Wallet, ClipboardCheck, Instagram, Info, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TeamCalendarModal from "@/components/TeamCalendarModal";
import { useRepData } from "@/hooks/useRepData";
import { ExternalLink as ExternalLinkComponent } from "@/components/ExternalLink";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import curatorNav from "@/assets/curator-navigation.jpeg";

interface ToolSection {
  title: string;
  description: string;
  icon: any;
  links: Array<{
    title: string;
    description: string;
    href: string;
    icon: any;
    comingSoon?: boolean;
    hasInfo?: boolean;
  }>;
}

const Tools = () => {
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const { repData } = useRepData();
  const navigate = useNavigate();

  // Smart link handler - opens Notion links in app
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Check if it's a Notion link and try to open in Notion app
    if (href.includes('notion.so') || href.includes('notion.site')) {
      e.preventDefault();
      // Extract page ID from URL and construct notion:// deep link
      const notionMatch = href.match(/([a-f0-9]{32}|[a-f0-9-]{36})/);
      if (notionMatch) {
        const pageId = notionMatch[1].replace(/-/g, '');
        const notionAppUrl = `notion://${pageId}`;
        
        // Try to open in Notion app
        window.location.href = notionAppUrl;
        
        // Fallback to web after short delay if app doesn't open
        setTimeout(() => {
          window.open(href, '_blank', 'noopener,noreferrer');
        }, 500);
        return;
      }
    }
    
    // For other links, allow default behavior (open in new tab)
  };

  const sections: ToolSection[] = [
    {
      title: "Sales Resources",
      description: "Daily tools to help you sell",
      icon: Wrench,
      links: [
        {
          title: "Competitor Cheat Sheet",
          description: "Quick reference for competitor products",
          href: "/tools/competitors",
          icon: Shield,
        },
        {
          title: "Useful Contacts",
          description: "Contact info and tips for key resources",
          href: "/tools/contacts",
          icon: Phone,
        },
        {
          title: "The Vault",
          description: "On-the-doors resource app",
          href: "https://calvinschofield.notion.site/the-vault?pvs=4",
          icon: FileText,
        },
        {
          title: "Simple Commission Calculator",
          description: "Calculate earnings based on the payscale",
          href: "https://docs.google.com/spreadsheets/d/1R-OlPLLCQNjVB-c-G88EQlUfyeYqjmHA_nG8UCYo4gU/edit?usp=sharing",
          icon: DollarSign,
        },
      ],
    },
    {
      title: "Team Info",
      description: "Get to know your team and find help",
      icon: Users,
      links: [
        {
          title: "About the Team",
          description: "Team story, culture, and expectations",
          href: "#",
          icon: Users,
          comingSoon: true,
        },
        {
          title: "Team Calendar",
          description: "View blitz dates and meetings",
          href: "#",
          icon: Calendar,
        },
        {
          title: "FAQ",
          description: "Common questions answered",
          href: "#",
          icon: HelpCircle,
          comingSoon: true,
      },
    ],
  },
  {
    title: "Vivint Portals",
    description: "Essential tools for tracking & managing your business",
    icon: TrendingUp,
    links: [
      {
        title: "Insider",
        description: "Simple way to track sales & upgrades",
        href: "https://insider.vivint.com/login#",
        icon: BarChart3,
      },
      {
        title: "Curator",
        description: "Detailed analytics & competitions",
        href: "https://curator.vivint.com/dashboard/production-test-production-report",
        icon: TrendingUp,
        hasInfo: true,
      },
      {
        title: "Source",
        description: "Paystubs, pay info & buyouts",
        href: "https://curator.vivint.com/dashboard/source-weekly-pay",
        icon: Wallet,
      },
    ],
  },
];

  const socialLinks = [
    {
      name: "Lead Region",
      handle: "lead.region",
      url: "https://www.instagram.com/lead.region/profilecard/?igsh=aDl1OGE5Nnk3djR2",
    },
    {
      name: "Triumph PTR",
      handle: "triumph.ptr",
      url: "https://www.instagram.com/triumph.ptr/profilecard/?igsh=emQzOWJldmludnYw",
    },
    {
      name: "SmartHomePros",
      handle: "thesmarthomepros",
      url: "https://www.instagram.com/thesmarthomepros/profilecard/?igsh=bHF1MWFoZTU2ZXd3",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <SectionIcon className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.links.map((link) => {
                  const LinkIcon = link.icon;
                  const isCalendar = link.title === "Team Calendar";
                  const isComingSoon = link.comingSoon;
                  const isInternalRoute = link.href.startsWith('/');
                  const hasCuratorInfo = link.hasInfo && link.title === "Curator";
                  
                  if (isCalendar) {
                    return (
                      <button
                        key={link.title}
                        onClick={() => setCalendarModalOpen(true)}
                        className="w-full flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-all group text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                          <LinkIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                            {link.title}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {link.description}
                          </p>
                        </div>
                      </button>
                    );
                  }
                  
                  if (isComingSoon) {
                    return (
                      <div
                        key={link.title}
                        className="flex items-start gap-3 p-4 rounded-lg border border-border opacity-50 cursor-not-allowed"
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <LinkIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm">
                              {link.title}
                            </h3>
                            <Badge variant="outline" className="text-xs">Coming soon</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {link.description}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (isInternalRoute) {
                    return (
                      <button
                        key={link.title}
                        onClick={() => navigate(link.href)}
                        className="w-full flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-all group text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                          <LinkIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                            {link.title}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {link.description}
                          </p>
                        </div>
                      </button>
                    );
                  }
                  
                  if (hasCuratorInfo) {
                    return (
                      <div key={link.title} className="relative">
                        <ExternalLinkComponent
                          href={link.href}
                          showIcon={false}
                          className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-all group no-underline hover:no-underline"
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                            <LinkIcon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 pr-8">
                            <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                              {link.title}
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {link.description}
                            </p>
                          </div>
                        </ExternalLinkComponent>
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute top-3 right-3 w-8 h-8 hover:bg-accent"
                            >
                              <Info className="w-4 h-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] flex flex-col">
                            <SheetHeader className="flex-shrink-0">
                              <SheetTitle>Curator Filter Tips</SheetTitle>
                            </SheetHeader>
                            <div className="overflow-y-auto flex-1 mt-4">
                              <SheetDescription className="text-left space-y-4">
                                <p className="text-sm">
                                  Curator is your go to resource for tracking sales.
                                </p>
                                <p className="text-sm">
                                  Click <strong>menu → Reports → Production Report</strong> and then filter.
                                </p>
                                <img 
                                  src={curatorNav} 
                                  alt="Curator navigation menu showing Reports and Production Report path" 
                                  className="w-full rounded-lg border border-border"
                                />
                                <p className="text-sm">
                                  <strong>Tip —</strong> "Group by" should be set to rep to see yourself and how you're doing in the office, region, division or company.
                                </p>
                              </SheetDescription>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </div>
                    );
                  }
                  
                  return (
                    <ExternalLinkComponent
                      key={link.title}
                      href={link.href}
                      showIcon={false}
                      className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-all group no-underline hover:no-underline"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <LinkIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
                          {link.title}
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {link.description}
                        </p>
                      </div>
                    </ExternalLinkComponent>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        {/* Stay Connected - Expandable */}
        <Collapsible open={socialsOpen} onOpenChange={setSocialsOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Instagram className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Stay Connected</CardTitle>
                    </div>
                    <CardDescription className="text-left">Follow to stay in the loop</CardDescription>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${socialsOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Horizontal Scroll Instagram Accounts */}
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {socialLinks.map((social) => (
                    <ExternalLinkComponent
                      key={social.name}
                      href={social.url}
                      showIcon={false}
                      className="flex-shrink-0 flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-accent transition-all no-underline hover:no-underline group w-32"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <Instagram className="w-8 h-8 text-white" />
                      </div>
                      <div className="text-xs font-semibold text-center group-hover:text-primary transition-colors">
                        {social.name}
                      </div>
                      <div className="text-xs text-center text-muted-foreground whitespace-nowrap">
                        @{social.handle}
                      </div>
                    </ExternalLinkComponent>
                  ))}
                </div>

                {/* SmartHomePros Embed */}
                <div>
                  <p className="text-sm font-semibold mb-3">Latest from SmartHomePros</p>
                  <div className="w-full overflow-hidden rounded-lg border border-border">
                    <iframe
                      src="https://www.instagram.com/thesmarthomepros/embed"
                      className="w-full h-[500px] border-0"
                      scrolling="no"
                      allowTransparency={true}
                      title="SmartHomePros Instagram"
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
            <CardDescription>
              Reach out to your team leader or use the AI assistant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full" 
              size="lg"
              asChild={!!(repData?.team_leader_phone)}
              disabled={!repData?.team_leader_phone}
            >
              {repData?.team_leader_phone ? (
                <a href={`tel:${repData.team_leader_phone}`}>
                  <Phone className="w-4 h-4 mr-2" />
                  Call {repData.team_leader}
                </a>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Call Leader
                </>
              )}
            </Button>
            <Button variant="default" className="w-full" size="lg" asChild>
              <ExternalLinkComponent href="https://chatgpt.com/g/g-67f0056351a081918e8849fb6310fa42-vivintgpt" showIcon={false} className="no-underline hover:no-underline">
                <HelpCircle className="w-4 h-4 mr-2" />
                Ask AI Assistant
                <ExternalLink className="w-3.5 h-3.5 ml-auto" />
              </ExternalLinkComponent>
            </Button>
          </CardContent>
        </Card>
      </div>

      <TeamCalendarModal open={calendarModalOpen} onOpenChange={setCalendarModalOpen} />
    </div>
  );
};

export default Tools;
