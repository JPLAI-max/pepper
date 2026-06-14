import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListOpportunities, getListOpportunitiesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { TrendingUp, ArrowRight, Building, Landmark, Percent, Clock, AlertCircle } from "lucide-react";
import { usePepper } from "@/pepper";

export default function Opportunities() {
  const { data: opportunities, isLoading } = useListOpportunities();
  const { setOpen } = usePepper();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-[120px] w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[250px]" />
          <Skeleton className="h-[250px]" />
          <Skeleton className="h-[250px]" />
        </div>
      </div>
    );
  }

  const recommended = opportunities?.filter(o => o.recommended) || [];
  const others = opportunities?.filter(o => !o.recommended) || [];

  const OpportunityCard = ({ opp, delay }: { opp: any, delay: number }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className={`h-full flex flex-col ${opp.recommended ? 'border-primary/50 shadow-md bg-primary/5' : 'border-border/50 shadow-sm'}`}>
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            <Badge variant={opp.kind === 'lending' ? 'secondary' : 'default'} className="uppercase text-xs">
              {opp.kind}
            </Badge>
            {opp.recommended && (
              <Badge className="bg-accent text-accent-foreground border-none">
                Recommended
              </Badge>
            )}
          </div>
          <CardTitle className="text-xl font-serif">{opp.title}</CardTitle>
          <CardDescription className="text-sm">{opp.summary}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="grid grid-cols-2 gap-4 text-sm mt-4">
            {opp.rate && (
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><Percent className="w-3 h-3" /> Target Rate</span>
                <span className="font-medium text-foreground">{opp.rate}</span>
              </div>
            )}
            {opp.term && (
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Term</span>
                <span className="font-medium text-foreground">{opp.term}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Min. Investment</span>
              <span className="font-medium text-foreground block">${opp.minAmount.toLocaleString()}</span>
            </div>
            {opp.tag && (
              <div>
                <span className="text-muted-foreground">Focus</span>
                <span className="font-medium text-foreground block">{opp.tag}</span>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-4 border-t border-border/10">
          <Button variant="ghost" className="w-full justify-between" onClick={() => setOpen(true)}>
            Ask Pepper about this
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-serif mb-2">Opportunities</h1>
          <p className="text-muted-foreground max-w-2xl">
            Curated real estate lending and investment opportunities aligned with your wealth building goals.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full">
          <AlertCircle className="w-4 h-4 mr-2" /> Find matching deals
        </Button>
      </div>

      {recommended.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-serif flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
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
        <div className="space-y-4 pt-8 border-t border-border">
          <h2 className="text-2xl font-serif">Explore Market</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {others.map((opp, i) => (
              <OpportunityCard key={opp.id} opp={opp} delay={0.2 + (i * 0.1)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}