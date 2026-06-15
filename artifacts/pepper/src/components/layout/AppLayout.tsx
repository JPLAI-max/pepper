import React from "react";
import { Link, useLocation } from "wouter";
import { usePepper } from "@/pepper";
import { Home, Target, Map, Shield, FileText, Briefcase, Menu, LogOut, Loader2, Sparkles, MessageSquare, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGetProfile } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { open, setOpen, status } = usePepper();
  
  const { data: profile, isLoading } = useGetProfile();

  const nav = [
    { label: "Command Center", href: "/dashboard", icon: Home },
    { label: "Goals", href: "/goals", icon: Target },
    { label: "Roadmap", href: "/roadmap", icon: Map },
    { label: "Readiness", href: "/readiness", icon: Shield },
    { label: "Opportunities", href: "/opportunities", icon: Briefcase },
    { label: "Documents", href: "/documents", icon: FileText },
  ];

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
        <div className="p-4 border-t border-border/40 bg-card/30">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-secondary text-foreground flex items-center justify-center font-medium shadow-inner border border-white/10">
              {profile?.displayName?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{profile?.displayName || "User"}</span>
              <span className="text-xs text-muted-foreground">Wealth Builder</span>
            </div>
          </div>
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

      {/* Floating Pepper Assistant Trigger (Mobile Bottom Center, Desktop Bottom Right) */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed md:bottom-8 md:right-8 bottom-6 left-1/2 md:left-auto transform md:translate-x-0 -translate-x-1/2 z-50 w-14 h-14 bg-card border border-border shadow-[0_8px_30px_rgba(0,0,0,0.4)] rounded-full flex items-center justify-center hover:scale-105 hover:bg-card/80 transition-all group backdrop-blur-xl"
          >
            {status === "idle" && (
              <div className="absolute inset-0 rounded-full border border-primary/20 scale-110 opacity-50 group-hover:opacity-100 transition-opacity" />
            )}
            <div className={`relative w-8 h-8 rounded-full flex items-center justify-center ${status !== "idle" ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(232,93,63,0.5)]" : "bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_15px_rgba(232,93,63,0.3)] transition-all duration-300"}`}>
              {status === "listening" && <span className="absolute -inset-1 rounded-full border border-primary animate-ping" />}
              {status === "speaking" && <span className="absolute -inset-1 rounded-full border border-primary opacity-50 animate-pulse" />}
              {status === "thinking" && <span className="absolute -inset-1 rounded-full border border-primary opacity-50 animate-pulse" style={{ animationDuration: '2s' }} />}
              <Sparkles className="w-4 h-4" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}