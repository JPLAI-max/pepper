import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PepperProvider } from "@/pepper";
import { AuthProvider, useAuth, AuthModalProvider } from "@/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { PepperAssistant } from "@/components/pepper/PepperAssistant";
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

const queryClient = new QueryClient();

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
      <Route component={NotFound} />
    </Switch>
  );
}

function GlobalAssistant() {
  // The Pepper panel is available everywhere, including the public landing,
  // so anonymous visitors can start a conversation before signing up.
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
