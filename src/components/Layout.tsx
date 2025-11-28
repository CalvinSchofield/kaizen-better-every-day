import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Wrench, BarChart3, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppDrawer } from "@/components/AppDrawer";
import { useAppMode } from "@/hooks/useAppMode";
import { useRepData } from "@/hooks/useRepData";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { isKnockingMode } = useAppMode();
  const { repData } = useRepData();
  
  const preseasonNavItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/training", icon: BookOpen, label: "Training" },
    { path: "/tools", icon: Wrench, label: "Tools" },
  ];

  const knockingNavItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/training", icon: BookOpen, label: "Training" },
    { path: "/tools", icon: Wrench, label: "Tools" },
    { path: "/track", icon: BarChart3, label: "Track" },
  ];

  const navItems = isKnockingMode ? knockingNavItems : preseasonNavItems;
  const firstName = repData?.name?.split(' ')[0];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header with Hamburger Menu */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <AppDrawer
          trigger={
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          }
          firstName={firstName}
        />
        <h1 className="text-lg font-semibold text-foreground">Kaizen</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50 pb-6">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-6 h-6 mb-1 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
                <span className={`text-xs ${isActive ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
