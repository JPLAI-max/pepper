import React from "react";
import { Link, useLocation } from "wouter";
import { usePepper } from "@/pepper";
import { Home, Target, Map, Shield, FileText, Briefcase, Menu, LogOut, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGetProfile } from "@workspace/api-client-react";
import { useAuth } from "@/auth";
import { HeyPepOverlay } from "@/components/pepper/HeyPepOverlay";
import { GlobalDropZone } from "@/components/pepper/GlobalDropZone";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { reset } = usePepper();
  const { user, logout } = useAuth();

  const { data: profile, isLoading } = useGetProfile();

  const handleLogout = async () => {
    await logout();
    await reset();
  };

  const nav = [
    { label: "Command Center", href: "/dashboard", icon: Home },
    { label: "Goals", href: "/goals", icon: Target },
    { label: "Roadmap", href: "/roadmap", icon: Map },
    { label: "Readiness", href: "/readiness", icon: Shield },
    { label: "Opportunities", href: "/opportunities", icon: Briefcase },
    { label: "Documents", href: "/documents", icon: FileText },
  ];

  // Full-screen takeover screens where the real assistant + document-upload
  // surfaces must be suppressed: the reveal stays a clean takeover, and the
  // /market & /financing simulation prototypes must not have any real engine
  // (assistant, document upload) active behind them.
  const isTakeover =
    location === "/reveal" ||
    location === "/market" ||
    location === "/financing";

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex w-full font-sans text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/40 bg-sidebar/80 backdrop-blur-xl h-screen sticky top-0 z-40">
        <div className="p-6 border-b border-border/40">
          <div className="flex items-center gap-3 text-foreground font-semibold text-xl tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(232,93,63,0.3)]">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span>Pepper</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {nav.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <span className="text-sm">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border/40 bg-card/30 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-secondary text-foreground flex items-center justify-center font-medium shadow-inner border border-white/10">
              {profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-foreground truncate">{profile?.displayName || "User"}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email || "Wealth Builder"}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 max-w-full relative">
        {/* Mobile header */}
        <header className="md:hidden h-16 border-b border-border/40 flex items-center justify-between px-4 bg-background/80 backdrop-blur-md sticky top-0 z-40">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 border-r-border/40 bg-sidebar">
              <div className="p-6 border-b border-border/40">
                <div className="flex items-center gap-3 text-foreground font-semibold text-xl tracking-tight">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(232,93,63,0.3)]">
                    <Sparkles className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span>Pepper</span>
                </div>
              </div>
              <nav className="p-4 space-y-1.5">
                {nav.map((item) => {
                  const isActive = location === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className={`flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 group ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          <div className="font-semibold text-foreground flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            Pepper
          </div>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 p-4 md:p-8 lg:p-10 pb-32">
          {children}
        </div>
      </main>

      {/* "Hey Pep" overlay — the assistant surface on authenticated app
          screens. Suppressed on full-screen takeover routes (/reveal and the
          /market & /financing simulations) so no real assistant runs there. */}
      {!isTakeover && <HeyPepOverlay />}

      {/* Page-level drag-and-drop: drop a financial document anywhere to share
          it with Pepper. Suppressed on takeover routes alongside the overlay. */}
      {!isTakeover && <GlobalDropZone />}
    </div>
  );
}