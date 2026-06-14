import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListOpportunities, getListOpportunitiesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { TrendingUp, ArrowRight, Percent, Clock, AlertCircle, Sparkles } from "lucide-react";
import { usePepper } from "@/pepper";

export default function Opportunities() {
  const { data: opportunities, isLoading } = useListOpportunities();
  const { setOpen } = usePepper();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-[100px] w-1/3 rounded-2xl bg-secondary/50" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          <Skeleton className="h-[300px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[300px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[300px] rounded-3xl bg-secondary/50" />
        </div>
      </div>
    );
  }

  const recommended = opportunities?.filter(o => o.recommended) || [];
  const others = opportunities?.filter(o => !o.recommended) || [];

  const OpportunityCard = ({ opp, delay }: { opp: any, delay: number }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <Card className={`h-full flex flex-col transition-all duration-300 rounded-3xl overflow-hidden relative group ${opp.recommended ? 'border-primary/30 bg-card/80 backdrop-blur-xl shadow-[0_0_30px_rgba(232,93,63,0.1)] hover:shadow-[0_0_40px_rgba(232,93,63,0.2)]' : 'border-white/5 bg-card/60 backdrop-blur-md shadow-lg hover:shadow-xl hover:bg-card/80'}`}>
        {opp.recommended && <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-primary/20 transition-colors" />}
        <CardHeader className="pb-4 relative z-10">
          <div className="flex justify-between items-start mb-4">
            <Badge variant="outline" className="uppercase text-[10px] tracking-widest font-semibold border-white/10 bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-full">
              {opp.kind}
            </Badge>
            {opp.recommended && (
              <Badge className="bg-primary/10 text-primary border border-primary/20 shadow-inner px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Recommended
              </Badge>
            )}
          </div>
          <CardTitle className="text-2xl font-serif tracking-tight text-foreground line-clamp-1">{opp.title}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground font-light leading-relaxed line-clamp-2 mt-2">{opp.summary}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 relative z-10">
          <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm mt-2 p-4 bg-secondary/30 rounded-2xl border border-white/5">
            {opp.rate && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5"><Percent className="w-3 h-3" /> Target Rate</span>
                <span className="font-serif text-2xl text-foreground tracking-tight">{opp.rate}</span>
              </div>
            )}
            {opp.term && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Term</span>
                <span className="font-medium text-foreground text-base mt-1 block">{opp.term}</span>
              </div>
            )}
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1 block">Min. Investment</span>
              <span className="font-medium text-foreground text-base">${opp.minAmount.toLocaleString()}</span>
            </div>
            {opp.tag && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1 block">Focus</span>
                <span className="font-medium text-foreground text-base capitalize">{opp.tag}</span>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-2 pb-6 px-6 relative z-10">
          <Button variant="ghost" className={`w-full justify-between h-12 rounded-xl transition-all ${opp.recommended ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(232,93,63,0.4)]' : 'bg-secondary/50 text-foreground hover:bg-secondary/80 border border-white/5'}`} onClick={() => setOpen(true)}>
            <span className="font-medium">Ask Pepper about this</span>
            <ArrowRight className="w-4 h-4 ml-2 opacity-70" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-4xl md:text-5xl font-serif mb-3 tracking-tight text-foreground">Opportunities</h1>
          <p className="text-muted-foreground text-lg max-w-2xl font-light">
            Curated real estate lending and investment opportunities aligned with your wealth building goals.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
          <Button onClick={() => setOpen(true)} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(232,93,63,0.4)] transition-all h-11 px-6">
            <AlertCircle className="w-4 h-4 mr-2" /> Find matching deals
          </Button>
        </motion.div>
      </div>

      {recommended.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-serif tracking-tight flex items-center text-foreground">
            <TrendingUp className="w-5 h-5 mr-3 text-primary" />
            Top Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommended.map((opp, i) => (
              <OpportunityCard key={opp.id} opp={opp} delay={0.1 + (i * 0.1)} />
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-6 pt-10 mt-10 border-t border-white/5">
          <h2 className="text-2xl font-serif tracking-tight text-muted-foreground">Explore Market</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity duration-500">
            {others.map((opp, i) => (
              <OpportunityCard key={opp.id} opp={opp} delay={0.2 + (i * 0.1)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
