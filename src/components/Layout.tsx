import { ReactNode, useMemo, useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Wrench, Target, Calendar, Menu, Lock, Save, RotateCcw, BarChart3, Trophy, UserPlus, TrendingUp } from "lucide-react";
import { hapticLight } from "@/utils/haptics";
import { Button } from "@/components/ui/button";
import { AppDrawer } from "@/components/AppDrawer";
import { useAppMode } from "@/hooks/useAppMode";
import { useRepData } from "@/hooks/useRepData";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useHeader } from "@/contexts/HeaderContext";
import { getCachedLayoutState, setCachedLayoutState } from "@/lib/queryPersister";
import { motion, AnimatePresence } from "framer-motion";
import { useRookieUnlockStatus } from "@/hooks/useRookieUnlockStatus";

interface LayoutProps {
  children: ReactNode;
  onSave?: () => void;
  onReset?: () => void;
  isSaving?: boolean;
  isResetting?: boolean;
  syncIndicator?: ReactNode;
  headerRightContent?: ReactNode;
  isEntryFinalized?: boolean;
  onViewRecap?: () => void;
}

const Layout = ({ children, onSave, onReset, isSaving, isResetting, syncIndicator, headerRightContent, isEntryFinalized, onViewRecap }: LayoutProps) => {
  const location = useLocation();
  const { repData } = useRepData();
  const { isKnockingMode } = useAppMode(repData);
  const { data: teamAccess } = useTeamAccess();
  const { customTitle, customRightContent } = useHeader();
  
  // Collapsed nav state
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const lastScrollY = useRef(0);
  const lastScrollEl = useRef<HTMLElement | Window | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
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
  
  // Check if user is a pre-blitz rookie - use centralized hook
  const { isPreBlitzRookie, isUnlocked } = useRookieUnlockStatus(repData);
  const isTrackLocked = isPreBlitzRookie;
  
  // Reset collapsed state on route change
  useEffect(() => {
    setIsNavCollapsed(false);
    lastScrollY.current = 0;
  }, [location.pathname]);
  
  // Scroll detection for collapse/expand
  useEffect(() => {
    let ticking = false;
    let lastTouchY = 0;

    const isScrollable = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 4;

    const findScrollableAncestor = (start: HTMLElement | null) => {
      let el: HTMLElement | null = start;
      while (el && el !== document.body) {
        if (isScrollable(el)) return el;
        el = el.parentElement;
      }
      return null;
    };

    const resolveScrollContext = (evtTarget: EventTarget | null) => {
      const targetEl = evtTarget instanceof HTMLElement ? evtTarget : null;
      const scrollableTarget = targetEl ? findScrollableAncestor(targetEl) : null;
      if (scrollableTarget) {
        return { el: scrollableTarget, y: scrollableTarget.scrollTop };
      }

      const main = scrollContainerRef.current;
      if (main && isScrollable(main)) {
        return { el: main, y: main.scrollTop };
      }

      return { el: window, y: window.scrollY || document.documentElement.scrollTop };
    };

    const applyDelta = (deltaY: number, evtTarget: EventTarget | null) => {
      const { el, y: currentScrollY } = resolveScrollContext(evtTarget);

      // If the scroll container changed (nested scroll areas), re-seed to avoid jitter.
      if (lastScrollEl.current !== el) {
        lastScrollEl.current = el;
        lastScrollY.current = currentScrollY;
        return;
      }

      if (deltaY > 8 && currentScrollY > SCROLL_THRESHOLD) {
        setIsNavCollapsed(true);
      } else if (deltaY < -8) {
        setIsNavCollapsed(false);
      }

      lastScrollY.current = currentScrollY;
    };

    const handleScroll = (e: Event) => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const { el, y: currentScrollY } = resolveScrollContext(e.target);

        if (lastScrollEl.current !== el) {
          lastScrollEl.current = el;
          lastScrollY.current = currentScrollY;
          ticking = false;
          return;
        }

        const scrollDiff = currentScrollY - lastScrollY.current;
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

    const handleWheel = (e: WheelEvent) => {
      // Wheel/touch are the most reliable signals when pages use nested overflow containers.
      applyDelta(e.deltaY, e.target);
    };

    const handleTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0]?.clientY ?? 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? lastTouchY;
      const deltaY = lastTouchY - y; // positive = scrolling down
      lastTouchY = y;
      applyDelta(deltaY, e.target);
    };

    // Seed initial position
    const seeded = resolveScrollContext(null);
    lastScrollEl.current = seeded.el;
    lastScrollY.current = seeded.y;

    const main = scrollContainerRef.current;
    main?.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("wheel", handleWheel, { passive: true });
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      main?.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("wheel", handleWheel);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // Dynamic navigation based on mode and user type - use effective values
  const getNavItems = () => {
    const isVetOrSoph = effectiveYear === "Vet" || effectiveYear === "Sophomore";
    const isPostBlitzRookieNav = effectiveYear === "Rookie" && isUnlocked;
    const isPreBlitzRookieNav = effectiveYear === "Rookie" && !isUnlocked;
    const hasCompletedPhase1 = repData?.ramp_phase_1_complete === true;

    if (effectiveIsKnockingMode) {
      if (effectiveIsLeader) {
        // Leaders in knocking mode: Home, Tools, Reports, Leaderboard (action: Track)
        return [
          { path: "/", icon: Home, label: "Home" },
          { path: "/tools", icon: Wrench, label: "Tools" },
          { path: "/team-reports", icon: BarChart3, label: "Reports" },
          { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
        ];
      }
      // Non-leaders in knocking mode: Home, Leaderboard, Tools, Calendar
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/calendar", icon: Calendar, label: "Calendar" },
      ];
    }

    // KNOCKING MODE OFF (Preseason)
    if (effectiveIsLeader) {
      // Leaders: Home, Tools, Calendar, Goals (action: My Group)
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/calendar", icon: Calendar, label: "Calendar" },
        { path: "/goals", icon: Target, label: "Goals" },
      ];
    }
    
    if (isVetOrSoph || isPostBlitzRookieNav) {
      // Non-leader Vets/Sophs/Post-blitz: Home, Tools, Calendar, Goals (action: Training)
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/calendar", icon: Calendar, label: "Calendar" },
        { path: "/goals", icon: Target, label: "Goals" },
      ];
    }

    // Pre-blitz Rookies
    if (isPreBlitzRookieNav) {
      // Home, Tools, Calendar, Goals (action: Training)
      return [
        { path: "/", icon: Home, label: "Home" },
        { path: "/tools", icon: Wrench, label: "Tools" },
        { path: "/calendar", icon: Calendar, label: "Calendar" },
        { path: "/goals", icon: Target, label: "Goals" },
      ];
    }

    // Default fallback
    return [
      { path: "/", icon: Home, label: "Home" },
      { path: "/tools", icon: Wrench, label: "Tools" },
      { path: "/calendar", icon: Calendar, label: "Calendar" },
      { path: "/goals", icon: Target, label: "Goals" },
    ];
  };
  
  // Get the action button based on mode and user type
  const getActionButton = () => {
    const isVetOrSoph = effectiveYear === "Vet" || effectiveYear === "Sophomore";
    const isPostBlitzRookieAction = effectiveYear === "Rookie" && isUnlocked;
    
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
  const activeItem = [...navItems, actionButton].find((item) => item.path === location.pathname);
  const CollapsedActiveIcon =
    activeItem && activeItem.path !== actionButton.path ? activeItem.icon : Home;

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
            ) : location.pathname === "/track" && onSave ? (
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
                {isEntryFinalized && onViewRecap ? (
                  // After finalization, show recap button instead of reset
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onViewRecap}
                    className="h-10 w-10"
                  >
                    <TrendingUp className="h-5 w-5" />
                  </Button>
                ) : onReset ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onReset}
                    disabled={isResetting}
                    className="h-10 w-10"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                ) : null}
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
      
      {/* Bottom Navigation - GitHub-style with smooth collapse animation */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: 'var(--nav-padding-bottom)' }}
      >
        <div className="px-4 pb-2">
          <motion.div
            className="mx-auto grid items-center gap-2"
            style={{ maxWidth: "380px", gridTemplateColumns: "1fr auto" }}
          >
            {/* Main nav container - morphs between collapsed bubble and expanded bar */}
            <motion.div
              layout="size"
              onClick={isNavCollapsed ? () => {
                hapticLight();
                setIsNavCollapsed(false);
              } : undefined}
              className={`bg-background/95 backdrop-blur-2xl border border-border/30 shadow-xl overflow-hidden ${
                isNavCollapsed ? "cursor-pointer justify-self-start" : "justify-self-stretch"
              }`}
              style={{ 
                borderRadius: isNavCollapsed ? 9999 : 32,
              }}
              animate={{
                width: isNavCollapsed ? 64 : "100%",
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
              whileTap={isNavCollapsed ? { scale: 0.95 } : undefined}
              aria-label={isNavCollapsed ? "Expand navigation" : undefined}
              data-tour={isNavCollapsed ? undefined : "bottom-nav"}
            >
              <div className="flex items-center justify-center h-16 w-full">
                {isNavCollapsed ? (
                  // COLLAPSED: Just the icon, no background ring
                  <div className="flex items-center justify-center w-full h-full">
                    <CollapsedActiveIcon
                      className="w-7 h-7 text-foreground"
                      strokeWidth={2.5}
                      fill="currentColor"
                    />
                  </div>
                ) : (
                  // EXPANDED: Full nav tabs
                  <div className="flex items-center justify-around py-2 w-full">
                    {navItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => hapticLight()}
                          className="relative flex flex-col items-center justify-center flex-1 py-1"
                        >
                          <motion.div
                            className={`flex flex-col items-center gap-0.5 ${
                              isActive ? "text-foreground" : "text-muted-foreground"
                            }`}
                            whileTap={{ scale: 0.88 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
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
                )}
              </div>
            </motion.div>

            {/* Separated action button - always stationary */}
            <Link to={actionButton.path} onClick={() => hapticLight()} className="justify-self-end">
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={{ 
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
                className="relative rounded-full shadow-xl flex flex-col items-center justify-center w-16 h-16 bg-primary text-primary-foreground"
              >
                <actionButton.icon
                  className="w-6 h-6"
                  strokeWidth={location.pathname === actionButton.path ? 2.5 : 2}
                  fill={location.pathname === actionButton.path ? "currentColor" : "none"}
                />
                <AnimatePresence mode="wait" initial={false}>
                  {!isNavCollapsed && (
                    <motion.span 
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 2 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 400,
                        damping: 25
                      }}
                      className="text-[11px] font-semibold leading-none"
                    >
                      {actionButton.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {actionButton.isLocked && (
                  <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5">
                    <Lock className="w-2.5 h-2.5 text-primary" />
                  </div>
                )}
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </nav>
    </div>
  );
};

export default Layout;