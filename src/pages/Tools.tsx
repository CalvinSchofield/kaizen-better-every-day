import { Wrench, DollarSign, BarChart3, Users, FileText, Phone, HelpCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ToolSection {
  title: string;
  description: string;
  icon: any;
  links: Array<{
    title: string;
    description: string;
    href: string;
    icon: any;
  }>;
}

const Tools = () => {
  const sections: ToolSection[] = [
    {
      title: "Sales Resources",
      description: "Daily tools to help you sell",
      icon: Wrench,
      links: [
        {
          title: "The Vault",
          description: "On-the-doors resource app",
          href: "https://calvinschofield.notion.site/the-vault?pvs=4",
          icon: FileText,
        },
        {
          title: "Payscales",
          description: "Commission structure & earnings",
          href: "https://docs.google.com/spreadsheets/d/1R-OlPLLCQNjVB-c-G88EQlUfyeYqjmHA_nG8UCYo4gU/edit?usp=sharing",
          icon: DollarSign,
        },
        {
          title: "Sales Tracking",
          description: "Track your progress & stats",
          href: "https://kaizen-better-every-day.lovable.app/auth",
          icon: BarChart3,
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
        },
        {
          title: "Leadership Directory",
          description: "Contact your leaders",
          href: "#",
          icon: Phone,
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
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Tools & Resources</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Quick access to everything you need
          </p>
        </div>
      </div>

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
                  return (
                    <a
                      key={link.title}
                      href={link.href}
                      className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-all group"
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
                    </a>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
            <CardDescription>
              Reach out to your team leader or use the AI assistant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full" size="lg">
              <Phone className="w-4 h-4 mr-2" />
              Contact Leader
            </Button>
            <Button variant="default" className="w-full" size="lg" asChild>
              <a href="/assistant">
                <HelpCircle className="w-4 h-4 mr-2" />
                Ask AI Assistant
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Tools;
