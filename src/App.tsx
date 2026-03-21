import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import { useSafeAreaFallback } from "./hooks/useSafeAreaFallback";
import { useKeyboardViewport } from "./hooks/useKeyboardViewport";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import OfflineIndicator from "./components/OfflineIndicator";
import { InAppNotificationBanner } from "./components/InAppNotificationBanner";
import { NativeAppPromo } from "./components/NativeAppPromo";
import TrackWithLayout from "./components/TrackWithLayout";
import SetupFlow from "./components/SetupFlow";
import { ChallengeWinListener } from "./components/ChallengeWinListener";
import { HydrationGate } from "./components/HydrationGate";
import { HeaderProvider } from "./contexts/HeaderContext";
import Home from "./pages/Home";
import Training from "./pages/Training";
import Tools from "./pages/Tools";
import Competitors from "./pages/Competitors";
import Contacts from "./pages/Contacts";
import CalendarWithLayout from "./components/CalendarWithLayout";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";
import TeamReports from "./pages/TeamReports";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import Goals from "./pages/Goals";
import MyGroup from "./pages/MyGroup";
import Leaderboard from "./pages/Leaderboard";
import Compete from "./pages/Compete";
import Customers from "./pages/Customers";
import Objections from "./pages/Objections";
import RampToBlitz from "./pages/RampToBlitz";
import UpgradeCheatSheet from "./pages/UpgradeCheatSheet";
import PackageBuilder from "./pages/PackageBuilder";
import Blitzes from "./pages/Blitzes";

import ProductKnowledge from "./pages/ProductKnowledge";
import AdminBlitzes from "./pages/AdminBlitzes";
import RecruitingContent from "./pages/RecruitingContent";
import AboutTeam from "./pages/AboutTeam";
import AddApplicant from "./pages/AddApplicant";
import AddRecruit from "./pages/AddRecruit";
import ReportsV2 from "./pages/ReportsV2";
import LogSale from "./pages/LogSale";
import Profile from "./pages/Profile";
import DebugNotifications from "./pages/DebugNotifications";
import Admin from "./pages/Admin";
import { queryPersister } from "./lib/queryPersister";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
  },
});

const App = () => {
  useSafeAreaFallback();
  useKeyboardViewport();

  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ 
        persister: queryPersister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: 'v3',
      }}
    >
      <HydrationGate>
        <HeaderProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <OfflineIndicator />
            <NativeAppPromo />
            <ChallengeWinListener />
            <BrowserRouter>
              <InAppNotificationBanner />
              <ScrollToTop />
              <Routes>
                {/* Auth routes - no Layout */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/setup" element={<ProtectedRoute><SetupFlow /></ProtectedRoute>} />

                {/* Pages that manage their own Layout internally */}
                <Route path="/track" element={<ProtectedRoute><TrackWithLayout /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><CalendarWithLayout /></ProtectedRoute>} />
                <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
                <Route path="/compete" element={<ProtectedRoute><Compete /></ProtectedRoute>} />
                <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
                <Route path="/my-group" element={<ProtectedRoute><MyGroup /></ProtectedRoute>} />

                {/* All other pages wrapped in Layout for consistent nav */}
                <Route path="/" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
                <Route path="/training" element={<ProtectedRoute><Layout><Training /></Layout></ProtectedRoute>} />
                <Route path="/tools" element={<ProtectedRoute><Layout><Tools /></Layout></ProtectedRoute>} />
                <Route path="/tools/competitors" element={<ProtectedRoute><Layout><Competitors /></Layout></ProtectedRoute>} />
                <Route path="/tools/contacts" element={<ProtectedRoute><Layout><Contacts /></Layout></ProtectedRoute>} />
                <Route path="/tools/objections" element={<ProtectedRoute><Layout><Objections /></Layout></ProtectedRoute>} />
                <Route path="/tools/product-knowledge" element={<ProtectedRoute><Layout><ProductKnowledge /></Layout></ProtectedRoute>} />
                <Route path="/product-knowledge" element={<ProtectedRoute><Layout><ProductKnowledge /></Layout></ProtectedRoute>} />
                <Route path="/tools/upgrades" element={<ProtectedRoute><Layout><UpgradeCheatSheet /></Layout></ProtectedRoute>} />
                <Route path="/tools/package-builder" element={<ProtectedRoute><Layout><PackageBuilder /></Layout></ProtectedRoute>} />
                <Route path="/blitzes" element={<ProtectedRoute><Layout><Blitzes /></Layout></ProtectedRoute>} />
                <Route path="/insights" element={<ProtectedRoute><Layout><Insights /></Layout></ProtectedRoute>} />
                <Route path="/team-reports" element={<ProtectedRoute><Layout><TeamReports /></Layout></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><Layout><Customers /></Layout></ProtectedRoute>} />
                <Route path="/ramp-to-blitz" element={<ProtectedRoute><Layout><RampToBlitz /></Layout></ProtectedRoute>} />
                <Route path="/profile/:userId" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
                <Route path="/admin/blitzes" element={<ProtectedRoute><Layout><AdminBlitzes /></Layout></ProtectedRoute>} />
                <Route path="/recruiting-content" element={<ProtectedRoute><Layout><RecruitingContent /></Layout></ProtectedRoute>} />
                <Route path="/about-team" element={<ProtectedRoute><Layout><AboutTeam /></Layout></ProtectedRoute>} />
                <Route path="/add-applicant" element={<ProtectedRoute><Layout><AddApplicant /></Layout></ProtectedRoute>} />
                <Route path="/add-recruit" element={<ProtectedRoute><Layout><AddRecruit /></Layout></ProtectedRoute>} />
                <Route path="/reports-v2" element={<ProtectedRoute><Layout><ReportsV2 /></Layout></ProtectedRoute>} />
                <Route path="/log-sale" element={<ProtectedRoute><Layout><LogSale /></Layout></ProtectedRoute>} />
                <Route path="/debug-notifications" element={<ProtectedRoute><Layout><DebugNotifications /></Layout></ProtectedRoute>} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </HeaderProvider>
      </HydrationGate>
    </PersistQueryClientProvider>
  );
};

export default App;
