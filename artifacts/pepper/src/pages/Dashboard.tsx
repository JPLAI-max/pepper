import React from "react";
import { Link } from "wouter";
import { useGetDashboardSummary, useGetReadinessScores } from "@workspace/api-client-react";
import { usePepper } from "@/pepper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, Shield, FileText, ArrowRight, Wallet, Banknote, ChevronRight, CheckCircle2, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: scores } = useGetReadinessScores();
  const { setOpen } = usePepper();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[160px] w-full rounded-3xl bg-secondary/50" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[220px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[220px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[220px] rounded-3xl bg-secondary/50" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[140px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[140px] rounded-3xl bg-secondary/50" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero / Command Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20, filter: "blur(5px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-secondary/80 to-card shadow-xl p-8 md:p-10 backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none transform translate-x-1/3 -translate-y-1/3" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-primary font-medium tracking-widest text-xs uppercase mb-4">
            <Sparkles className="w-4 h-4" />
            <span>Command Center</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4 tracking-tight">Your wealth trajectory is looking strong.</h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl font-light">
            You are on track. Based on your current cashflow and roadmap, you're ready to take the next step toward your goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={() => setOpen(true)} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(232,93,63,0.4)] h-12 px-8 font-medium text-base transition-all">
              <Sparkles className="w-5 h-5 mr-2" />
              Ask Pepper
            </Button>
            {summary.nextStep && (
              <Button asChild variant="outline" className="rounded-full h-12 px-8 font-medium text-base border-white/10 bg-secondary/30 hover:bg-secondary text-foreground backdrop-blur-sm transition-all">
                <Link href="/roadmap">
                  View Next Action <ChevronRight className="w-5 h-5 ml-1 text-muted-foreground" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
          <Card className="h-full border-white/5 bg-card/60 backdrop-blur-md shadow-lg hover:shadow-xl hover:bg-card/80 transition-all rounded-3xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-gold/10 transition-colors" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-muted-foreground uppercase tracking-wider text-xs font-semibold">
                <Wallet className="w-4 h-4 text-gold" />
                Total Net Worth
              </CardDescription>
              <CardTitle className="text-4xl md:text-5xl font-serif text-foreground tracking-tight pt-2">
                ${summary.netWorth.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium text-muted-foreground mt-6 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span>Assets</span>
                  <span className="text-foreground">${summary.totalAssets.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Debt</span>
                  <span className="text-foreground">${summary.totalDebt.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
          <Card className="h-full border-white/5 bg-card/60 backdrop-blur-md shadow-lg hover:shadow-xl hover:bg-card/80 transition-all rounded-3xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-success/10 transition-colors" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-muted-foreground uppercase tracking-wider text-xs font-semibold">
                <Banknote className="w-4 h-4 text-success" />
                Monthly Cashflow
              </CardDescription>
              <CardTitle className="text-4xl md:text-5xl font-serif text-foreground tracking-tight pt-2">
                ${summary.monthlyCashflow.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mt-6 leading-relaxed">
                Your monthly income minus expenses. This positive cashflow is the engine for your wealth creation.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <Card className="h-full border-white/5 bg-card/60 backdrop-blur-md shadow-lg hover:shadow-xl hover:bg-card/80 transition-all rounded-3xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-primary/10 transition-colors" />
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-muted-foreground uppercase tracking-wider text-xs font-semibold">
                <Shield className="w-4 h-4 text-primary" />
                Top Readiness Score
              </CardDescription>
              <CardTitle className="text-4xl md:text-5xl font-serif text-primary tracking-tight pt-2">
                {summary.topScore ? summary.topScore.score : 0}<span className="text-2xl text-muted-foreground">/100</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-foreground mt-6 mb-1">
                {summary.topScore ? summary.topScore.label : "Profile Setup"}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {summary.topScore ? "You are in a strong position for this." : "Complete your profile to unlock scores."}
              </p>
              <Button variant="link" className="p-0 h-auto text-primary font-medium hover:text-primary-foreground transition-colors group-hover:underline" asChild>
                <Link href="/readiness" className="flex items-center">
                  Analyze readiness <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Readiness Scores — all 6 */}
      {scores && scores.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-2xl tracking-tight text-foreground">Readiness</h2>
            <Link href="/readiness" className="text-sm text-primary font-medium flex items-center hover:underline">
              Full breakdown <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {scores.map((s) => (
              <Card key={s.key} className="border-white/5 bg-card/40 backdrop-blur-md rounded-2xl shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{s.label}</span>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gold">{s.tier}</span>
                  </div>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-3xl font-serif text-foreground tracking-tight">{s.score}</span>
                    <span className="text-sm text-muted-foreground mb-1">/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gold to-primary rounded-full transition-all" style={{ width: `${s.score}%` }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Curated Opportunities */}
      {summary.recommendedOpportunities && summary.recommendedOpportunities.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-2xl tracking-tight text-foreground">Curated Opportunities</h2>
            <Link href="/opportunities" className="text-sm text-primary font-medium flex items-center hover:underline">
              View all <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summary.recommendedOpportunities.slice(0, 3).map((opp) => (
              <Card key={opp.id} className="border-white/5 bg-card/40 backdrop-blur-md rounded-2xl shadow-lg hover:bg-card/60 transition-all group">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{opp.kind}</span>
                  </div>
                  <h3 className="font-serif text-lg text-foreground tracking-tight mb-2 leading-tight">{opp.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">{opp.summary}</p>
                  <div className="flex items-center gap-4 text-sm">
                    {opp.rate && <span className="text-gold font-medium">{opp.rate}</span>}
                    {opp.term && <span className="text-muted-foreground">{opp.term}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
          <Link href="/goals" className="block">
            <Card className="border-white/5 bg-card/40 backdrop-blur-md hover:bg-secondary/40 transition-all rounded-3xl cursor-pointer group">
              <CardContent className="p-6 md:p-8 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-secondary border border-white/5 flex items-center justify-center text-foreground shadow-inner group-hover:scale-105 transition-transform">
                    <Target className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl text-foreground mb-1">Wealth Goals</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <span className="text-success font-medium flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1" />{summary.achievedGoals} achieved</span>
                      <span className="opacity-30">•</span>
                      <span>{summary.activeGoals} active</span>
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/50 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
          <Link href="/documents" className="block">
            <Card className="border-white/5 bg-card/40 backdrop-blur-md hover:bg-secondary/40 transition-all rounded-3xl cursor-pointer group">
              <CardContent className="p-6 md:p-8 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-secondary border border-white/5 flex items-center justify-center text-foreground shadow-inner group-hover:scale-105 transition-transform">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl text-foreground mb-1">Document Vault</h3>
                    <p className="text-sm text-muted-foreground">
                      <span className="text-foreground font-medium">{summary.documentsComplete}</span> of {summary.documentsTotal} needed files verified
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/50 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}