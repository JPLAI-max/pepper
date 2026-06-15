import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PepperProvider } from "@/pepper";
import { AppLayout } from "@/components/layout/AppLayout";
import { PepperAssistant } from "@/components/pepper/PepperAssistant";
import { useGetProfile } from "@workspace/api-client-react";
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

function ProtectedRoute({ component: Component, path }: { component: any, path: string }) {
  const { data: profile, isLoading } = useGetProfile();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && profile && !profile.onboarded && location !== "/onboarding") {
      setLocation("/onboarding");
    } else if (!isLoading && profile && profile.onboarded && location === "/onboarding") {
      setLocation("/dashboard");
    }
  }, [profile, isLoading, location, setLocation]);

  if (isLoading) return null;

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
  const [location] = useLocation();
  if (location === "/") return null;
  return <PepperAssistant />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PepperProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <GlobalAssistant />
          </WouterRouter>
        </PepperProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
