import { BookOpen, FileText, Users, TrendingUp, Shield, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TrainingCategory {
  title: string;
  description: string;
  icon: any;
  items: Array<{
    title: string;
    href: string;
    isNew?: boolean;
  }>;
}

const Training = () => {
  const categories: TrainingCategory[] = [
    {
      title: "Core Sales Training",
      description: "Essential skills every rep needs to succeed",
      icon: Users,
      items: [
        { title: "Sales Process", href: "#" },
        { title: "Handling Objections", href: "#" },
        { title: "Paperwork Help", href: "#" },
        { title: "Service Ticket Workflow", href: "#" },
        { title: "Upgrades 101", href: "#", isNew: true },
        { title: "Competitor Cheat Sheets", href: "#" },
      ],
    },
    {
      title: "Path to Pro",
      description: "Advanced modules for post-blitz mastery",
      icon: TrendingUp,
      items: [
        { title: "Advanced Closing Techniques", href: "#" },
        { title: "Territory Management", href: "#" },
        { title: "Customer Relationship Building", href: "#" },
        { title: "Upselling Strategies", href: "#" },
      ],
    },
    {
      title: "Product Knowledge",
      description: "Deep dive into Vivint systems and features",
      icon: Shield,
      items: [
        { title: "Smart Home Basics", href: "#" },
        { title: "Security Systems Overview", href: "#" },
        { title: "Camera Systems", href: "#" },
        { title: "Smart Locks & Entry", href: "#" },
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
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Training Library</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Access all training materials and resources
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Just-in-Time Training */}
        <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Recommended for You</CardTitle>
            </div>
            <CardDescription>
              Based on your current step in the journey
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="#"
              className="flex items-center justify-between p-3 rounded-lg bg-card hover:bg-accent transition-colors"
            >
              <span className="font-medium">Getting Started Guide</span>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </a>
            <a
              href="#"
              className="flex items-center justify-between p-3 rounded-lg bg-card hover:bg-accent transition-colors"
            >
              <span className="font-medium">First Week Checklist</span>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </a>
          </CardContent>
        </Card>

        {/* Training Categories */}
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Card key={category.title}>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{category.title}</CardTitle>
                </div>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {category.items.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium group-hover:text-primary transition-colors">
                        {item.title}
                      </span>
                      {item.isNew && (
                        <Badge variant="outline" className="text-xs">
                          New
                        </Badge>
                      )}
                    </div>
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </a>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Training;
