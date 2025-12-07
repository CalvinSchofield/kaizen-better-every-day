import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import OfflineIndicator from "./components/OfflineIndicator";
import TrackWithLayout from "./components/TrackWithLayout";
import SetupFlow from "./components/SetupFlow";
import Home from "./pages/Home";
import Training from "./pages/Training";
import Tools from "./pages/Tools";
import Competitors from "./pages/Competitors";
import Contacts from "./pages/Contacts";
import Calendar from "./pages/Calendar";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";
import TeamReports from "./pages/TeamReports";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import Goals from "./pages/Goals";
import MyGroup from "./pages/MyGroup";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst', // Prefer cache when offline
    },
  },
});

const App = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed, but app should still work
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
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
                  <Layout>
                    <Calendar />
                  </Layout>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
