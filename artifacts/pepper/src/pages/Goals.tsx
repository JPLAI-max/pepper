import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, 
  getListGoalsQueryKey, getGetDashboardSummaryQueryKey 
} from "@workspace/api-client-react";
import { usePepper } from "@/pepper";
import { Plus, Target, CheckCircle2, PauseCircle, Trash2, Pencil, Mic, MicOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

type GoalData = {
  id?: number;
  title: string;
  category: any;
  targetAmount: number;
  currentAmount: number;
  status: any;
  priority: number;
  note: string;
};

export default function Goals() {
  const { data: goals, isLoading } = useListGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const queryClient = useQueryClient();
  const { dictateStart, dictateStop, dictating, setOpen: openPepper } = usePepper();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalData | null>(null);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleSave = () => {
    if (!editingGoal || !editingGoal.title) return;
    
    if (editingGoal.id) {
      updateGoal.mutate({
        id: editingGoal.id,
        data: {
          title: editingGoal.title,
          category: editingGoal.category,
          targetAmount: editingGoal.targetAmount,
          currentAmount: editingGoal.currentAmount,
          status: editingGoal.status,
          priority: editingGoal.priority,
          note: editingGoal.note
        }
      }, { onSuccess: () => { invalidateQueries(); setIsDialogOpen(false); } });
    } else {
      createGoal.mutate({
        data: {
          title: editingGoal.title,
          category: editingGoal.category || "wealth",
          targetAmount: editingGoal.targetAmount || 0,
          currentAmount: editingGoal.currentAmount || 0,
          status: editingGoal.status || "active",
          priority: editingGoal.priority || 1,
          note: editingGoal.note || ""
        }
      }, { onSuccess: () => { invalidateQueries(); setIsDialogOpen(false); } });
    }
  };

  const handleDelete = (id: number) => {
    deleteGoal.mutate({ id }, { onSuccess: invalidateQueries });
  };

  const handleStatusChange = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "achieved" : currentStatus === "achieved" ? "paused" : "active";
    updateGoal.mutate({ id, data: { status: newStatus as any } }, { onSuccess: invalidateQueries });
  };

  const openNewGoal = () => {
    setEditingGoal({
      title: "",
      category: "wealth",
      targetAmount: 10000,
      currentAmount: 0,
      status: "active",
      priority: 1,
      note: ""
    });
    setIsDialogOpen(true);
  };

  const openEditGoal = (goal: any) => {
    setEditingGoal({ ...goal });
    setIsDialogOpen(true);
  };

  const handleDictate = async () => {
    if (dictating) {
      const text = await dictateStop();
      if (text && editingGoal) {
        setEditingGoal({ ...editingGoal, note: (editingGoal.note ? editingGoal.note + " " : "") + text });
      }
    } else {
      await dictateStart();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-[80px] w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[250px]" />
          <Skeleton className="h-[250px]" />
        </div>
      </div>
    );
  }

  const activeGoals = goals?.filter(g => g.status === 'active') || [];
  const achievedGoals = goals?.filter(g => g.status === 'achieved') || [];
  const pausedGoals = goals?.filter(g => g.status === 'paused') || [];

  const GoalCard = ({ goal, delay }: { goal: any, delay: number }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className={`h-full flex flex-col border-border/50 ${goal.status === 'achieved' ? 'bg-primary/5' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{goal.category.replace('_', ' ')}</div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditGoal(goal)}>
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(goal.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <CardTitle className="text-xl font-serif line-clamp-1">{goal.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          {goal.targetAmount > 0 && (
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-sm">
                <span className="font-medium">${goal.currentAmount.toLocaleString()}</span>
                <span className="text-muted-foreground">of ${goal.targetAmount.toLocaleString()}</span>
              </div>
              <Progress value={Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)} className="h-2" />
            </div>
          )}
          {goal.note && <p className="text-sm text-muted-foreground mt-4 line-clamp-2">{goal.note}</p>}
        </CardContent>
        <CardFooter className="pt-4 border-t border-border/10 bg-muted/10 rounded-b-xl flex justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            className={goal.status === 'active' ? 'text-primary' : 'text-muted-foreground'}
            onClick={() => handleStatusChange(goal.id, goal.status)}
          >
            {goal.status === 'active' && <><Target className="w-4 h-4 mr-2" /> Active</>}
            {goal.status === 'achieved' && <><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Achieved</>}
            {goal.status === 'paused' && <><PauseCircle className="w-4 h-4 mr-2" /> Paused</>}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-serif mb-2">Goals</h1>
          <p className="text-muted-foreground max-w-2xl">
            Track your milestones and wealth targets. Break big dreams into achievable numbers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openPepper(true)} className="rounded-full">Ask Pepper</Button>
          <Button onClick={openNewGoal} className="rounded-full"><Plus className="w-4 h-4 mr-2" /> New Goal</Button>
        </div>
      </div>

      {!goals?.length && (
        <div className="text-center py-20 px-4 bg-muted/20 rounded-2xl border border-dashed border-border">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-medium mb-2">No goals set yet</h3>
          <p className="text-muted-foreground mb-6">Setting clear financial targets is the first step to building wealth.</p>
          <Button onClick={openNewGoal}><Plus className="w-4 h-4 mr-2" /> Create Your First Goal</Button>
        </div>
      )}

      {activeGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-serif">Active Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeGoals.map((g, i) => <GoalCard key={g.id} goal={g} delay={i * 0.1} />)}
          </div>
        </div>
      )}

      {(achievedGoals.length > 0 || pausedGoals.length > 0) && (
        <div className="space-y-8 pt-8 border-t border-border">
          {achievedGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-serif flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-primary" /> Achieved
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80">
                {achievedGoals.map((g, i) => <GoalCard key={g.id} goal={g} delay={i * 0.1} />)}
              </div>
            </div>
          )}
          {pausedGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-serif text-muted-foreground">Paused</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
                {pausedGoals.map((g, i) => <GoalCard key={g.id} goal={g} delay={i * 0.1} />)}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingGoal?.id ? 'Edit Goal' : 'Create Goal'}</DialogTitle>
          </DialogHeader>
          {editingGoal && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Goal Title</Label>
                <Input id="title" value={editingGoal.title} onChange={e => setEditingGoal({...editingGoal, title: e.target.value})} placeholder="e.g. Save for Down Payment" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={editingGoal.category} onValueChange={(val) => setEditingGoal({...editingGoal, category: val})}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homeownership">Homeownership</SelectItem>
                      <SelectItem value="investing">Investing</SelectItem>
                      <SelectItem value="passive_income">Passive Income</SelectItem>
                      <SelectItem value="debt">Debt Reduction</SelectItem>
                      <SelectItem value="credit">Credit Building</SelectItem>
                      <SelectItem value="wealth">General Wealth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={editingGoal.status} onValueChange={(val) => setEditingGoal({...editingGoal, status: val})}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="achieved">Achieved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target">Target Amount ($)</Label>
                  <Input id="target" type="number" value={editingGoal.targetAmount} onChange={e => setEditingGoal({...editingGoal, targetAmount: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="current">Current Amount ($)</Label>
                  <Input id="current" type="number" value={editingGoal.currentAmount} onChange={e => setEditingGoal({...editingGoal, currentAmount: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="space-y-2 relative">
                <div className="flex justify-between items-end">
                  <Label htmlFor="note">Notes & Strategy</Label>
                  <Button type="button" variant="ghost" size="icon" className={`h-8 w-8 ${dictating ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} onClick={handleDictate}>
                    {dictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </div>
                <Textarea 
                  id="note" 
                  value={editingGoal.note} 
                  onChange={e => setEditingGoal({...editingGoal, note: e.target.value})} 
                  placeholder="Why is this important? What's your plan?"
                  className="min-h-[100px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createGoal.isPending || updateGoal.isPending || !editingGoal?.title}>
              {(createGoal.isPending || updateGoal.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}