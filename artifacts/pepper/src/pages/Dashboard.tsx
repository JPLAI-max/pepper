import React from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { usePepper } from "@/pepper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Target, Shield, FileText, ArrowRight, Wallet, Banknote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { setOpen } = usePepper();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[120px] w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-primary text-primary-foreground rounded-3xl p-8 relative overflow-hidden"
      >
        <div className="relative z-10">
          <h1 className="text-4xl font-serif mb-2">Welcome to your command center.</h1>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl">
            You are making great progress on your wealth building journey. Let's look at your financial snapshot.
          </p>
          <div className="flex gap-4">
            <Button onClick={() => setOpen(true)} variant="secondary" className="rounded-full font-medium">
              <Sparkles className="w-4 h-4 mr-2 text-primary" />
              Ask Pepper
            </Button>
            {summary.nextStep && (
              <Button asChild variant="outline" className="rounded-full bg-transparent border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground">
                <Link href="/roadmap">
                  View Next Step
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-1/4 translate-y-1/4">
          <Sparkles className="w-96 h-96" />
        </div>
      </motion.div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="h-full border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium">
                <Wallet className="w-4 h-4 text-primary" />
                Net Worth
              </CardDescription>
              <CardTitle className="text-4xl font-serif">
                ${summary.netWorth.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Total Assets</span>
                  <span className="font-medium text-foreground">${summary.totalAssets.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Debt</span>
                  <span className="font-medium text-foreground">${summary.totalDebt.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="h-full border-border/50 shadow-sm hover:shadow-md transition-shadow bg-secondary/30">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium">
                <Banknote className="w-4 h-4 text-primary" />
                Monthly Cashflow
              </CardDescription>
              <CardTitle className="text-4xl font-serif">
                ${summary.monthlyCashflow.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mt-4">
                Your monthly income minus expenses. This is your engine for wealth creation.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="h-full border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium">
                <Shield className="w-4 h-4 text-primary" />
                Top Readiness Score
              </CardDescription>
              <CardTitle className="text-4xl font-serif text-primary">
                {summary.topScore ? summary.topScore.score : 0}/100
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mt-4">
                {summary.topScore ? summary.topScore.label : "Complete your profile to see your score."}
              </p>
              <Button variant="link" className="p-0 h-auto mt-4 text-primary" asChild>
                <Link href="/readiness" className="flex items-center">
                  View all scores <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-border/50">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Goals Progress</h3>
                  <p className="text-sm text-muted-foreground">{summary.achievedGoals} achieved, {summary.activeGoals} active</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/goals"><ArrowRight className="w-5 h-5 text-muted-foreground" /></Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-border/50">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Document Vault</h3>
                  <p className="text-sm text-muted-foreground">{summary.documentsComplete} of {summary.documentsTotal} needed filed</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/documents"><ArrowRight className="w-5 h-5 text-muted-foreground" /></Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
