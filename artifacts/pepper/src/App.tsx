import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PepperProvider } from "@/pepper";
import { AuthProvider, useAuth, AuthModalProvider } from "@/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { PepperAssistant } from "@/components/pepper/PepperAssistant";
import { AmbientOverlay } from "@/components/pepper/AmbientOverlay";
import { TourBanner } from "@/components/pepper/TourBanner";
import { useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";

// Placeholder pages
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Onboarding from "@/pages/Onboarding";
import Goals from "@/pages/Goals";
import Roadmap from "@/pages/Roadmap";
import Readiness from "@/pages/Readiness";
import Documents from "@/pages/Documents";
import Opportunities from "@/pages/Opportunities";
import Reveal from "@/pages/Reveal";
import Privacy from "@/pages/Privacy";
import Market from "@/pages/Market";
import Financing from "@/pages/Financing";
import CapitalMarkets from "@/pages/CapitalMarkets";

const queryClient = new QueryClient();

const REVEAL_SHOWN_KEY = "pepper.revealShown";

// When the coach marks the session ready, take the user to "The Reveal" once.
// Re-arms if readiness is ever reset so a future reveal can fire again.
function RevealRedirect() {
  const { isAuthenticated } = useAuth();
  const { data: profile } = useGetProfile({
    query: { enabled: isAuthenticated, queryKey: getGetProfileQueryKey() },
  });
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !profile) return;
    if (!profile.readyForReveal) {
      try {
        localStorage.removeItem(REVEAL_SHOWN_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (location === "/reveal") return;
    let shown = false;
    try {
      shown = localStorage.getItem(REVEAL_SHOWN_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (shown) return;
    try {
      localStorage.setItem(REVEAL_SHOWN_KEY, "1");
    } catch {
      /* ignore */
    }
    setLocation("/reveal");
  }, [isAuthenticated, profile, location, setLocation]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: any, path: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useGetProfile({
    query: { enabled: isAuthenticated, queryKey: getGetProfileQueryKey() },
  });
  const [location, setLocation] = useLocation();

  // Auth gate: anonymous users cannot reach protected routes. Send them to the
  // public landing where they can chat and be invited to set up an account.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!isAuthenticated || profileLoading || !profile) return;
    if (!profile.onboarded && location !== "/onboarding") {
      setLocation("/onboarding");
    } else if (profile.onboarded && location === "/onboarding") {
      setLocation("/dashboard");
    }
  }, [profile, profileLoading, isAuthenticated, location, setLocation]);

  if (authLoading) return null;
  if (!isAuthenticated) return null;
  if (profileLoading) return null;

  if (location === "/onboarding") {
    return <Component />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/onboarding">
        <ProtectedRoute component={Onboarding} path="/onboarding" />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} path="/dashboard" />
      </Route>
      <Route path="/goals">
        <ProtectedRoute component={Goals} path="/goals" />
      </Route>
      <Route path="/roadmap">
        <ProtectedRoute component={Roadmap} path="/roadmap" />
      </Route>
      <Route path="/readiness">
        <ProtectedRoute component={Readiness} path="/readiness" />
      </Route>
      <Route path="/documents">
        <ProtectedRoute component={Documents} path="/documents" />
      </Route>
      <Route path="/opportunities">
        <ProtectedRoute component={Opportunities} path="/opportunities" />
      </Route>
      <Route path="/reveal">
        <ProtectedRoute component={Reveal} path="/reveal" />
      </Route>
      {/* The simulation/demo takeover routes are public so the guided tour can
          showcase them without requiring an account. They render full-screen
          (no AppLayout) and the assistant orb is suppressed on them below. */}
      <Route path="/market" component={Market} />
      <Route path="/financing" component={Financing} />
      <Route path="/capital-markets" component={CapitalMarkets} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Authenticated app screens where the "Hey Pep" overlay (mounted in AppLayout)
// is the assistant surface. /reveal intentionally has no assistant.
const APP_SHELL_ROUTES = [
  "/dashboard",
  "/goals",
  "/roadmap",
  "/readiness",
  "/opportunities",
  "/documents",
  "/reveal",
  "/market",
  "/financing",
  "/capital-markets",
];

// Full-screen takeover/demo routes where the assistant orb must never surface —
// for guests OR authenticated users — so no real engine runs over the
// simulation (these render outside AppLayout, so suppression happens here).
const TAKEOVER_ROUTES = [
  "/reveal",
  "/market",
  "/financing",
  "/capital-markets",
];

function GlobalAssistant() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  // Never show the orb on full-screen takeover/demo routes (guest or authed),
  // including the guided-tour stops a guest can now reach.
  if (TAKEOVER_ROUTES.includes(location)) return null;
  // On authenticated app-shell screens the Hey Pep overlay handles assistance,
  // so the standard panel is suppressed there to avoid a duplicate orb. It
  // remains available everywhere else (public landing, onboarding) so anonymous
  // visitors can start a conversation before signing up.
  if (isAuthenticated && APP_SHELL_ROUTES.includes(location)) return null;
  return <PepperAssistant />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PepperProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthModalProvider>
                <Router />
                <GlobalAssistant />
                <AmbientOverlay />
                <TourBanner />
                <RevealRedirect />
              </AuthModalProvider>
            </WouterRouter>
          </PepperProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
