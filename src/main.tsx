import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { LangProvider } from "@/lib/i18n";
import { PlayerProvider } from "@/lib/player";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/lib/theme";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Browse = lazy(() => import("./pages/Browse.tsx"));
const SearchPage = lazy(() => import("./pages/SearchPage.tsx"));
const ContentDetails = lazy(() => import("./pages/ContentDetails.tsx"));
const PersonPage = lazy(() => import("./pages/PersonPage.tsx"));
const Subscriptions = lazy(() => import("./pages/Subscriptions.tsx"));
const Publish = lazy(() => import("./pages/Publish.tsx"));
const Challenges = lazy(() => import("./pages/Challenges.tsx"));
const ChallengeDetails = lazy(() => import("./pages/ChallengeDetails.tsx"));
const Live = lazy(() => import("./pages/Live.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Transparency = lazy(() => import("./pages/Transparency.tsx"));
const Collections = lazy(() => import("./pages/Collections.tsx"));
const Faq = lazy(() => import("./pages/Faq.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Library = lazy(() => import("./pages/Library.tsx"));
const HistoryPage = lazy(() => import("./pages/History.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Legal = lazy(() => import("./pages/Legal.tsx"));
const EbookReader = lazy(() => import("./pages/EbookReader.tsx"));
const PlaylistPage = lazy(() => import("./pages/Playlist.tsx"));
const Studio = lazy(() => import("./pages/Studio.tsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


// SiteLayout must be inside Router; wraps all public pages with Header/Footer/Player
function SiteRoutes() {
  const SiteLayout = React.useRef(
    lazy(() => import("./components/layout/SiteLayout")),
  ).current;

  return (
    <Routes>
      <Route element={<Suspense fallback={<RouteLoading />}><SiteLayout /></Suspense>}>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/browse/:type" element={<Browse />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/content/:slug" element={<ContentDetails />} />
        <Route path="/author/:id" element={<PersonPage kind="author" />} />
        <Route path="/narrator/:id" element={<PersonPage kind="narrator" />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/publish" element={<Publish />} />
        <Route
          path="/studio"
          element={
            <RequireAuth title="الاستوديو للناشرين والمؤلفين" description="سجّل الدخول بحساب ناشر أو مؤلف.">
              <Studio />
            </RequireAuth>
          }
        />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/challenges/:id" element={<ChallengeDetails />} />
        <Route path="/live" element={<Live />} />
        <Route path="/about" element={<About />} />
        <Route path="/transparency" element={<Transparency />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/faq" element={<Faq />} />
        <Route
          path="/profile"
          element={
            <RequireAuth
              title="سجّل الدخول لعرض حسابك"
              description="الملف الشخصي متاح للمستخدمين المسجلين."
            >
              <Profile />
            </RequireAuth>
          }
        />
        <Route path="/library" element={<Library />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/terms" element={<Legal />} />
        <Route path="/privacy" element={<Legal />} />
        <Route path="/copyright" element={<Legal />} />
        <Route
          path="/playlists/:id"
          element={
            <RequireAuth title="سجّل الدخول لعرض القوائم" description="قوائمك الخاصة متاحة للمستخدمين المسجلين.">
              <PlaylistPage />
            </RequireAuth>
          }
        />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireAuth
            title="هذه الصفحة للمديرين فقط"
            description="سجّل الدخول بحساب مدير للوصول إلى لوحة التحكم."
          >
            <Suspense fallback={<RouteLoading />}>
              <AdminDashboard />
            </Suspense>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <ThemeProvider>
        <LangProvider>
          <PlayerProvider>
            <BrowserRouter>
              <RouteSyncer />
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/auth" element={<AuthPage redirectAfterAuth="/" />} />
                  <Route path="/admin-login" element={<AdminLogin />} />
                  <Route path="/read/:slug" element={<Suspense fallback={<RouteLoading />}><EbookReader /></Suspense>} />
                  <Route path="/ar/*" element={<SiteRoutes />} />
                  <Route path="/*" element={<SiteRoutes />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Toaster />
          </PlayerProvider>
        </LangProvider>
        </ThemeProvider>
      </ConvexAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
