import { Shield, TrendingUp, MessageSquare, Calculator, Phone, GraduationCap, BarChart3, Wallet, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExternalLink as ExternalLinkComponent } from "@/components/ExternalLink";
import { useNavigate } from "react-router-dom";
import { useUplineContact } from "@/hooks/useUplineContact";
import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import curatorNav from "@/assets/curator-navigation.jpeg";

const toolCards = [
  {
    title: "Competitors",
    description: "Quick cheat sheet",
    icon: Shield,
    href: "/tools/competitors",
  },
  {
    title: "Upgrades",
    description: "Pain points & PRMR",
    icon: TrendingUp,
    href: "/tools/upgrades",
  },
  {
    title: "Objections",
    description: "Responses ready",
    icon: MessageSquare,
    href: "/tools/objections",
  },
  {
    title: "Packages",
    description: "Monthly estimate",
    icon: Calculator,
    href: "/tools/package-builder",
  },
  {
    title: "Contacts",
    description: "Key numbers",
    icon: Phone,
    href: "/tools/contacts",
  },
];

const vivintPortals = [
  {
    title: "Training",
    description: "Videos & podcasts",
    icon: GraduationCap,
    href: "https://dthvivinttraining.conveyour.com/ui/portal/",
  },
  {
    title: "Insider",
    description: "Track sales",
    icon: BarChart3,
    href: "https://insider.vivint.com/login#",
  },
  {
    title: "Curator",
    description: "Analytics",
    icon: TrendingUp,
    href: "https://curator.vivint.com/dashboard/production-test-production-report",
    hasInfo: true,
  },
  {
    title: "Source",
    description: "Paystubs & pay",
    icon: Wallet,
    href: "https://curator.vivint.com/dashboard/source-weekly-pay",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const Tools = () => {
  const navigate = useNavigate();
  const { data: upline, isLoading: uplineLoading } = useUplineContact();

  const handleContact = (method: 'call' | 'text') => {
    if (!upline?.phone) return;
    const clean = upline.phone.replace(/\D/g, '');
    if (method === 'call') {
      window.open(`tel:${clean}`, '_self');
    } else {
      window.open(`sms:${clean}`, '_self');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">

        {/* Sales Tools Grid */}
        <motion.div
          className="grid grid-cols-3 gap-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {toolCards.map((tool) => {
            const Icon = tool.icon;
            return (
              <motion.button
                key={tool.title}
                variants={itemVariants}
                onClick={() => navigate(tool.href)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-accent active:scale-[0.97] transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5.5 h-5.5 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground leading-tight">{tool.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{tool.description}</p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Vivint Portals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Vivint Portals</h2>
          <div className="grid grid-cols-2 gap-2">
            {vivintPortals.map((portal) => {
              const Icon = portal.icon;

              if (portal.hasInfo) {
                return (
                  <div key={portal.title} className="relative">
                    <ExternalLinkComponent
                      href={portal.href}
                      showIcon={false}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-accent transition-all no-underline hover:no-underline w-full"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                          {portal.title}
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </p>
                        <p className="text-[10px] text-muted-foreground">{portal.description}</p>
                      </div>
                    </ExternalLinkComponent>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-1.5 w-7 h-7 hover:bg-accent"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="rounded-t-3xl max-h-[80dvh] flex flex-col">
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
                  key={portal.title}
                  href={portal.href}
                  showIcon={false}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-accent transition-all no-underline hover:no-underline"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                      {portal.title}
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </p>
                    <p className="text-[10px] text-muted-foreground">{portal.description}</p>
                  </div>
                </ExternalLinkComponent>
              );
            })}
          </div>
        </motion.div>

        {/* Need Help? - Smart Upline Contact */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
          className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/8 to-primary/3 p-4"
        >
          <p className="text-sm font-semibold text-foreground mb-1">Need Help?</p>
          {uplineLoading ? (
            <p className="text-xs text-muted-foreground">Finding your upline...</p>
          ) : upline ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Reach out to <span className="font-medium text-foreground">{upline.name}</span>
                <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  {upline.year}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-9 text-xs font-semibold gap-1.5"
                  onClick={() => handleContact('call')}
                  disabled={!upline.phone}
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-9 text-xs font-semibold gap-1.5"
                  onClick={() => handleContact('text')}
                  disabled={!upline.phone}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Text
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Contact your team leader for help</p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Tools;
