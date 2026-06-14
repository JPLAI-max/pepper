import React from "react";
import { Link, useLocation } from "wouter";
import { usePepper } from "@/pepper";
import { Home, Target, Map, Shield, FileText, Briefcase, Menu, LogOut, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGetProfile } from "@workspace/api-client-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { open, setOpen, status } = usePepper();
  
  const { data: profile, isLoading } = useGetProfile();

  const nav = [
    { label: "Dashboard", href: "/", icon: Home },
    { label: "Goals", href: "/goals", icon: Target },
    { label: "Roadmap", href: "/roadmap", icon: Map },
    { label: "Readiness", href: "/readiness", icon: Shield },
    { label: "Documents", href: "/documents", icon: FileText },
    { label: "Opportunities", href: "/opportunities", icon: Briefcase },
  ];

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  // If not onboarded and not on onboarding page, we'll let the App router handle redirect
  
  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar h-screen sticky top-0">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xl">
            <Sparkles className="w-6 h-6" />
            <span>Pepper</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
              {profile?.displayName?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{profile?.displayName || "User"}</span>
              <span className="text-xs text-muted-foreground">Wealth Builder</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 max-w-full relative">
        {/* Mobile header */}
        <header className="md:hidden h-16 border-b flex items-center justify-between px-4 bg-background sticky top-0 z-20">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-6 border-b">
                <div className="flex items-center gap-2 text-primary font-bold text-xl">
                  <Sparkles className="w-6 h-6" />
                  <span>Pepper</span>
                </div>
              </div>
              <nav className="p-4 space-y-1">
                {nav.map((item) => {
                  const isActive = location === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <div className="font-bold text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Pepper
          </div>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 p-4 md:p-8 lg:p-10 pb-32">
          {children}
        </div>
      </main>

      {/* Floating Pepper Assistant Trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageSquare className="w-6 h-6" />
          {status !== "idle" && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-accent rounded-full animate-ping" />
          )}
        </button>
      )}
    </div>
  );
}
