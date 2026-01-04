import { ReactNode, useMemo, useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Wrench, Target, Calendar, Menu, Lock, Save, RotateCcw, BarChart3, Trophy, UserPlus } from "lucide-react";
import { hapticLight } from "@/utils/haptics";
import { Button } from "@/components/ui/button";
import { AppDrawer } from "@/components/AppDrawer";
import { useAppMode } from "@/hooks/useAppMode";
import { useRepData } from "@/hooks/useRepData";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useHeader } from "@/contexts/HeaderContext";
import { getCachedLayoutState, setCachedLayoutState } from "@/lib/queryPersister";
import { motion, AnimatePresence } from "framer-motion";

interface LayoutProps {
  children: ReactNode;
  onSave?: () => void;
  onReset?: () => void;
  isSaving?: boolean;
  isResetting?: boolean;
  syncIndicator?: ReactNode;
  headerRightContent?: ReactNode;
}

const Layout = ({ children, onSave, onReset, isSaving, isResetting, syncIndicator, headerRightContent }: LayoutProps) => {
  const location = useLocation();
  const { repData } = useRepData();
  const { isKnockingMode } = useAppMode(repData);
  const { data: teamAccess } = useTeamAccess();
  const { customTitle, customRightContent } = useHeader();
  
  // Collapsed nav state
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const SCROLL_THRESHOLD = 80;
  
  // Get cached layout state for instant rendering (prevents flash)
  const cachedState = useMemo(() => getCachedLayoutState(), []);
  
  // Use cached values initially, then update when real data arrives
  const isLeader = teamAccess?.accessLevel && teamAccess.accessLevel !== 'none';
  const effectiveIsLeader = isLeader ?? cachedState?.isLeader ?? false;
  const effectiveIsKnockingMode = isKnockingMode ?? cachedState?.isKnockingMode ?? false;
  const effectiveYear = repData?.year ?? cachedState?.year ?? "Rookie";
  
  // Update cache when real data is available
  useEffect(() => {
    if (repData?.year !== undefined && isLeader !== undefined) {
      setCachedLayoutState({
        year: repData.year,
        isLeader: isLeader ?? false,
        isKnockingMode: isKnockingMode ?? false,
      });
    }
  }, [repData?.year, isLeader, isKnockingMode]);
  
  // Check if user is a pre-blitz rookie - use effective values
  const isRookie = effectiveYear === "Rookie";
  
  
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  const now = new Date();
  const hasAttendedBlitz = blitzes.some((blitz: any) => {
    if (!blitz.date || !blitz.endDate) return false;
    
    // Check if today matches the blitz start date (unlock immediately on blitz day)
    // Use local date, not UTC, to avoid timezone conversion issues
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const blitzStartStr = blitz.date;
    const isStartingToday = todayStr === blitzStartStr;
    
    // Check if blitz is currently active (between start and end date)
    const startDate = new Date(blitz.date + 'T00:00:00');
    const endDate = new Date(blitz.endDate + 'T23:59:59');
    const isCurrentlyActive = now >= startDate && now <= endDate;
    
    // Check if blitz has ended (past)
    const hasEnded = endDate < now;
    
    return isStartingToday || isCurrentlyActive || hasEnded;
  });

  const isTrackLocked = isRookie && !hasAttendedBlitz;
  
  // Reset collapsed state on route change
  useEffect(() => {
    setIsNavCollapsed(false);
    lastScrollY.current = 0;
  }, [location.pathname]);
  
  // Scroll detection for collapse/expand
  useEffect(() => {
    let ticking = false;

    const getScrollY = () => {
      const main = scrollContainerRef.current;
      if (main && main.scrollHeight > main.clientHeight + 4) {
        return main.scrollTop;
      }
      return window.scrollY || document.documentElement.scrollTop;
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const currentScrollY = getScrollY();
        const scrollDiff = currentScrollY - lastScrollY.current;

        // Only react to meaningful scroll amounts
        if (Math.abs(scrollDiff) > 10) {
          if (scrollDiff > 0 && currentScrollY > SCROLL_THRESHOLD) {
            setIsNavCollapsed(true);
          } else if (scrollDiff < 0) {
            setIsNavCollapsed(false);
          }

          lastScrollY.current = currentScrollY;
        }

        ticking = false;
      });
    };

    // Seed initial position
    lastScrollY.current = getScrollY();

    // Listen to the scroll container (most pages) AND document/window (fallback)
    const main = scrollContainerRef.current;
    main?.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      main?.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true } as any);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  // Dynamic navigation based on mode and user type - use effective values
  const getNavItems = () => {
    const isVetOrSoph = effectiveYear === "Vet" || effectiveYear === "Sophomore";
    const isPostBlitzRookie = effectiveYear === "Rookie" && hasAttendedBlitz;
    const isPreBlitzRookie = effectiveYear === "Rookie" && !hasAttendedBlitz;
    const hasCompletedPhase1 = repData?.ramp_phase_1_complete === true;

    if (effectiveIsKnockingMode) {
      // KNOCKING MODE ON
      if (isVetOrSoph || effectiveIsLeader) {
        // Vets/Sophomores/Leaders: Home, Leaderboard, Insights, Calendar
        return [
          { path: "/", icon: Home, label: "Home" },
          { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
          { path: "/insights", icon: BarChart3, label: "Insights" },
          { path: "/calendar", icon: Calendar, label: "Calendar" },
        ];
      } else if (isPostBlitzRookie) {
        // Post-blitz Rookies: Home, Leaderboard, Tools, Calendar
        return [
          { path: "/", icon: Home, label: "Home" },
          { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
          { path: "/tools", icon: Wrench, label: "Tools" },
          { path: "/calendar", icon: Calendar, label: "Calendar" },
        ];
      }
    }

    // KNOCKING MODE OFF (Preseason)
    if (effectiveIsLeader) {
      // Leaders: Home, Tools, Calendar, Goals (action: My Group)
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/calendar", icon: Calendar, label: "Calendar" },
        { path: "/goals", icon: Trophy, label: "Goals" },
      ];
    }
    
    if (isVetOrSoph || isPostBlitzRookie) {
      // Non-leader Vets/Sophs/Post-blitz: Home, Tools, Calendar, Goals (action: Training)
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/calendar", icon: Calendar, label: "Calendar" },
        { path: "/goals", icon: Trophy, label: "Goals" },
      ];
    }

    // Pre-blitz Rookies
    if (isPreBlitzRookie) {
      // Home, Tools, Calendar, Goals (action: Training)
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/calendar", icon: Calendar, label: "Calendar" },
        { path: "/goals", icon: Trophy, label: "Goals" },
      ];
    }

    // Default fallback
    return [
      { path: "/", icon: Home, label: "Home" },
      { path: "/tools", icon: Wrench, label: "Tools" },
      { path: "/calendar", icon: Calendar, label: "Calendar" },
      { path: "/goals", icon: Trophy, label: "Goals" },
    ];
  };
  
  // Get the action button based on mode and user type
  const getActionButton = () => {
    const isVetOrSoph = effectiveYear === "Vet" || effectiveYear === "Sophomore";
    const isPostBlitzRookie = effectiveYear === "Rookie" && hasAttendedBlitz;
    
    if (effectiveIsKnockingMode) {
      // KNOCKING MODE: Track is always the action
      return { path: "/track", icon: Target, label: "Track", isLocked: isTrackLocked };
    }
    
    // KNOCKING MODE OFF
    if (effectiveIsLeader) {
      return { path: "/my-group", icon: UserPlus, label: "My Group", isLocked: false };
    }
    
    // Non-leaders get Training
    return { path: "/training", icon: BookOpen, label: "Training", isLocked: false };
  };

  const navItems = getNavItems();
  const actionButton = getActionButton();
  const firstName = repData?.name?.split(' ')[0];
  
  // Determine if we're on the home page to match header color
  const isHomePage = location.pathname === "/";
  
  // Get currently active tab for collapsed state
  const activeItem = [...navItems, actionButton].find(item => item.path === location.pathname);
  
  // Get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/":
        return "Kaizen";
      case "/training":
        return "Training";
      case "/tools":
        return "Tools";
      case "/track":
        return "Track";
      case "/calendar":
        return "Calendar";
      case "/insights":
        return "Insights";
      case "/settings":
        return "Personalize";
      case "/team-reports":
        return "Reports";
      case "/goals":
        return "Goals";
      case "/my-group":
        return "My Group";
      case "/customers":
        return "Customers";
      case "/leaderboard":
        return "Leaderboard";
      default:
        return "Kaizen";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingBottom: 'calc(var(--nav-height) + var(--nav-padding-bottom))' }}>
      {/* Header with Hamburger Menu - uniform styling across pages */}
      <header 
        className={`sticky top-0 z-40 border-b px-4 ${
          isHomePage 
            ? "bg-primary text-primary-foreground border-primary-foreground/20" 
            : "bg-card text-foreground border-border"
        }`} 
        style={{ 
          paddingTop: 'var(--header-padding-top)',
          paddingBottom: '0.75rem',
          minHeight: 'calc(var(--header-height) + var(--header-padding-top))'
        }}
      >
        <div className="flex items-center h-10 gap-2">
          {/* Left side - menu button */}
          <AppDrawer
            trigger={
              <Button variant="ghost" size="icon" className={`h-10 w-10 flex-shrink-0 ${isHomePage ? "text-primary-foreground hover:bg-primary-foreground/10" : ""}`}>
                <Menu className="h-6 w-6" />
              </Button>
            }
            firstName={firstName}
          />
          
          {/* Center - Page title */}
          <div className="flex-1 flex justify-center">
            <h1 className={`text-lg font-semibold ${isHomePage ? "text-primary-foreground" : "text-foreground"}`}>
              {customTitle || getPageTitle()}
            </h1>
          </div>
          
          {/* Right side - action buttons */}
          <div className="flex-shrink-0">
            {customRightContent ? (
              customRightContent
            ) : headerRightContent ? (
              headerRightContent
            ) : location.pathname === "/track" && onSave && onReset ? (
              <div className="flex items-center gap-2">
                {syncIndicator}
                <Button
                  onClick={onSave}
                  disabled={isSaving}
                  size="icon"
                  className="h-10 w-10 bg-primary hover:bg-primary-dark text-primary-foreground shadow-md"
                >
                  <Save className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  disabled={isResetting}
                  className="h-10 w-10"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="w-10" /> 
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto" ref={scrollContainerRef}>
        {children}
      </main>
      
      {/* Bottom Navigation - GitHub-style with collapse animation */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: 'var(--nav-padding-bottom)' }}
      >
        <div className="px-4 pb-2">
          <AnimatePresence initial={false}>
            {isNavCollapsed ? (
              // COLLAPSED STATE: Just active tab bubble + action button
              <motion.div
                key="collapsed"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="flex items-center justify-between mx-auto"
                style={{ maxWidth: '380px' }}
              >
                {/* Collapsed bubble with active tab */}
                <motion.button
                  onClick={() => {
                    hapticLight();
                    setIsNavCollapsed(false);
                  }}
                  className="flex items-center justify-center bg-background/95 backdrop-blur-2xl border border-border/30 shadow-xl rounded-full p-3"
                  whileTap={{ scale: 0.95 }}
                >
                  {activeItem && activeItem.path !== actionButton.path && (
                    <activeItem.icon 
                      className="w-6 h-6 text-foreground" 
                      strokeWidth={2.5}
                      fill="currentColor"
                    />
                  )}
                  {(!activeItem || activeItem.path === actionButton.path) && (
                    <Home 
                      className="w-6 h-6 text-foreground" 
                      strokeWidth={2.5}
                      fill="currentColor"
                    />
                  )}
                </motion.button>
                
                {/* Action button - always visible */}
                <Link
                  to={actionButton.path}
                  onClick={() => hapticLight()}
                  className="relative"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex items-center justify-center rounded-full p-3 shadow-xl ${
                      location.pathname === actionButton.path
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/90 text-primary-foreground"
                    }`}
                  >
                    <actionButton.icon 
                      className="w-6 h-6" 
                      strokeWidth={location.pathname === actionButton.path ? 2.5 : 2}
                      fill={location.pathname === actionButton.path ? "currentColor" : "none"}
                    />
                    {actionButton.isLocked && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5">
                        <Lock className="w-2.5 h-2.5 text-primary" />
                      </div>
                    )}
                  </motion.div>
                </Link>
              </motion.div>
            ) : (
              // EXPANDED STATE: Full nav with separated action button
              <motion.div
                key="expanded"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                data-tour="bottom-nav"
                className="flex items-center gap-2 mx-auto"
                style={{ maxWidth: '380px' }}
              >
                {/* Main nav tabs */}
                <div className="flex items-center justify-around flex-1 bg-background/95 backdrop-blur-2xl border border-border/30 shadow-xl rounded-[32px] py-2">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => hapticLight()}
                        className="relative flex flex-col items-center justify-center flex-1 py-1 active:scale-90 transition-transform duration-150"
                      >
                        <motion.div 
                          className={`flex flex-col items-center gap-0.5 ${
                            isActive ? "text-foreground" : "text-muted-foreground"
                          }`}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Icon 
                            className="w-6 h-6" 
                            strokeWidth={isActive ? 2.5 : 1.5}
                            fill={isActive ? "currentColor" : "none"}
                          />
                          <span className={`text-[11px] ${isActive ? "font-semibold" : "font-normal"}`}>
                            {item.label}
                          </span>
                        </motion.div>
                      </Link>
                    );
                  })}
                </div>
                
                {/* Separated action button */}
                <Link
                  to={actionButton.path}
                  onClick={() => hapticLight()}
                  className="relative"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex flex-col items-center justify-center rounded-full px-4 py-2 shadow-xl ${
                      location.pathname === actionButton.path
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/90 text-primary-foreground"
                    }`}
                  >
                    <actionButton.icon 
                      className="w-6 h-6" 
                      strokeWidth={location.pathname === actionButton.path ? 2.5 : 2}
                      fill={location.pathname === actionButton.path ? "currentColor" : "none"}
                    />
                    <span className="text-[11px] font-semibold">
                      {actionButton.label}
                    </span>
                    {actionButton.isLocked && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5">
                        <Lock className="w-2.5 h-2.5 text-primary" />
                      </div>
                    )}
                  </motion.div>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </div>
  );
};

export default Layout;