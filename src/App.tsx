import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Layout from "./components/Layout";
import { useSafeAreaFallback } from "./hooks/useSafeAreaFallback";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import OfflineIndicator from "./components/OfflineIndicator";
import TrackWithLayout from "./components/TrackWithLayout";
import SetupFlow from "./components/SetupFlow";
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
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import Goals from "./pages/Goals";
import MyGroup from "./pages/MyGroup";
import Customers from "./pages/Customers";
import Objections from "./pages/Objections";
import RampToBlitz from "./pages/RampToBlitz";
import UpgradeCheatSheet from "./pages/UpgradeCheatSheet";
import WeeklyRecapBuilder from "./pages/WeeklyRecapBuilder";
import ProductKnowledge from "./pages/ProductKnowledge";
import AdminBlitzes from "./pages/AdminBlitzes";
import RecruitingContent from "./pages/RecruitingContent";
import AboutTeam from "./pages/AboutTeam";
import { queryPersister } from "./lib/queryPersister";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60 * 1000, // 15 minutes - data stays fresh longer
      gcTime: 60 * 60 * 1000, // 60 minutes - keep in cache longer
      retry: 1,
      refetchOnWindowFocus: false, // Don't refetch just because tab was focused
      refetchOnMount: false, // Don't refetch on component mount if data exists
      refetchOnReconnect: true,
      networkMode: 'offlineFirst', // Prefer cache when offline
    },
  },
});

const App = () => {
  // Apply safe area fallback for iOS PWA mode when env() fails
  useSafeAreaFallback();
  
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed, but app should still work
      });
    }
  }, []);

  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ 
        persister: queryPersister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        buster: 'v1', // Bump this to invalidate all cached data
      }}
    >
      <HeaderProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
          <BrowserRouter>
            <ScrollToTop />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/setup" element={<ProtectedRoute><SetupFlow /></ProtectedRoute>} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Training />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Tools />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/competitors"
              element={
                <ProtectedRoute>
                  <Competitors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/contacts"
              element={
                <ProtectedRoute>
                  <Contacts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/objections"
              element={
                <ProtectedRoute>
                  <Objections />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/product-knowledge"
              element={
                <ProtectedRoute>
                  <ProductKnowledge />
                </ProtectedRoute>
              }
            />
            <Route
              path="/product-knowledge"
              element={
                <ProtectedRoute>
                  <ProductKnowledge />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/upgrades"
              element={
                <ProtectedRoute>
                  <UpgradeCheatSheet />
                </ProtectedRoute>
              }
            />
            <Route
              path="/track"
              element={
                <ProtectedRoute>
                  <TrackWithLayout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarWithLayout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/insights"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Insights />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/team-reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TeamReports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  <Goals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-group"
              element={
                <ProtectedRoute>
                  <MyGroup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Customers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ramp-to-blitz"
              element={
                <ProtectedRoute>
                  <RampToBlitz />
                </ProtectedRoute>
              }
            />
            {/* Redirect /profile to /settings */}
            <Route
              path="/profile"
              element={<Navigate to="/settings" replace />}
            />
            <Route
              path="/admin/blitzes"
              element={
                <ProtectedRoute>
                  <AdminBlitzes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/weekly-recap"
              element={
                <ProtectedRoute>
                  <WeeklyRecapBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiting-content"
              element={
                <ProtectedRoute>
              <RecruitingContent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/about-team"
          element={
            <ProtectedRoute>
              <AboutTeam />
            </ProtectedRoute>
          }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </TooltipProvider>
      </HeaderProvider>
    </PersistQueryClientProvider>
  );
};

export default App;
