import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { usePepper } from "@/pepper";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, ArrowRight, Loader2, Check, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";

const formSchema = z.object({
  displayName: z.string().min(2, "Name is required"),
  monthlyIncome: z.coerce.number().min(0),
  monthlyExpenses: z.coerce.number().min(0),
  cashSavings: z.coerce.number().min(0),
  otherAssets: z.coerce.number().min(0),
  totalDebt: z.coerce.number().min(0),
  creditScore: z.coerce.number().min(300).max(850),
  preferredVoice: z.enum(["female", "male"]),
});

type FormValues = z.infer<typeof formSchema>;

export default function Onboarding() {
  const { data: profile, isLoading: isProfileLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { dictateStart, dictateStop, dictating, setVoice, status } = usePepper();

  const [step, setStep] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: "",
      monthlyIncome: 0,
      monthlyExpenses: 0,
      cashSavings: 0,
      otherAssets: 0,
      totalDebt: 0,
      creditScore: 700,
      preferredVoice: "female",
    },
  });

  React.useEffect(() => {
    if (profile && step === 0) {
      form.reset({
        displayName: profile.displayName || "",
        monthlyIncome: profile.monthlyIncome || 0,
        monthlyExpenses: profile.monthlyExpenses || 0,
        cashSavings: profile.cashSavings || 0,
        otherAssets: profile.otherAssets || 0,
        totalDebt: profile.totalDebt || 0,
        creditScore: profile.creditScore || 700,
        preferredVoice: (profile.preferredVoice as "female" | "male") || "female",
      });
    }
  }, [profile, form, step]);

  const steps = [
    {
      title: "Welcome to Pepper",
      description: "Let's get to know you. What should I call you?",
      fields: ["displayName"],
    },
    {
      title: "Cashflow",
      description: "How much is coming in and going out each month?",
      fields: ["monthlyIncome", "monthlyExpenses"],
    },
    {
      title: "Assets & Debt",
      description: "What's the current state of your savings and liabilities?",
      fields: ["cashSavings", "otherAssets", "totalDebt"],
    },
    {
      title: "Credit & Preferences",
      description: "Your credit score helps unlock opportunities. Also, how would you like me to sound?",
      fields: ["creditScore", "preferredVoice"],
    },
  ];

  const handleNext = async () => {
    const currentFields = steps[step].fields as any[];
    const isValid = await form.trigger(currentFields);
    
    if (isValid) {
      if (step < steps.length - 1) {
        setStep(step + 1);
      } else {
        const values = form.getValues();
        setVoice(values.preferredVoice);
        
        updateProfile.mutate({
          data: {
            ...values,
            onboarded: true,
          }
        }, {
          onSuccess: (data) => {
            queryClient.setQueryData(getGetProfileQueryKey(), data);
            setLocation("/");
          }
        });
      }
    }
  };

  const handleDictate = async (fieldName: any) => {
    if (dictating) {
      const text = await dictateStop();
      if (text) {
        if (fieldName === "displayName") {
          form.setValue(fieldName, text);
        } else {
          // Try to extract numbers from speech for numeric fields
          const num = parseInt(text.replace(/[^0-9]/g, ""), 10);
          if (!isNaN(num)) {
            form.setValue(fieldName, num);
          }
        }
      }
    } else {
      await dictateStart();
    }
  };

  if (isProfileLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-12 px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gold/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        
        {/* Pepper Assistant Avatar / Header */}
        <div className="flex flex-col items-center mb-12">
          <div className="relative mb-6">
            <div className={`w-20 h-20 rounded-full border border-border/50 flex items-center justify-center bg-card shadow-[0_0_30px_rgba(0,0,0,0.5)] ${status !== 'idle' ? 'shadow-[0_0_30px_rgba(232,93,63,0.3)]' : ''} transition-shadow duration-500`}>
              {status === "listening" && <span className="absolute -inset-2 rounded-full border border-primary animate-ping" />}
              {status === "speaking" && <span className="absolute -inset-2 rounded-full border border-primary opacity-50 animate-pulse" />}
              <Sparkles className={`w-8 h-8 ${status !== 'idle' ? 'text-primary' : 'text-foreground'}`} />
            </div>
          </div>
          <h1 className="text-4xl font-serif text-foreground text-center mb-2 tracking-tight">Hi, I'm Pepper.</h1>
          <p className="text-muted-foreground text-center max-w-md">I am your financial command operator. Let's set up your wealth profile.</p>
        </div>

        <div className="mb-8 flex gap-3">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-primary shadow-[0_0_10px_rgba(232,93,63,0.5)]' : 'bg-secondary'}`} />
          ))}
        </div>

        <Card className="bg-card/50 backdrop-blur-xl border-white/5 shadow-2xl rounded-3xl overflow-hidden relative">
          {/* Subtle card inner glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none" />
          
          <CardContent className="p-8 md:p-10 relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -20, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <div className="mb-10 text-center">
                  <h2 className="text-2xl font-serif text-foreground mb-3">{steps[step].title}</h2>
                  <p className="text-muted-foreground text-sm">{steps[step].description}</p>
                </div>

                <Form {...form}>
                  <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                    {step === 0 && (
                      <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-muted-foreground uppercase tracking-wider text-xs font-semibold ml-1">First Name</FormLabel>
                            <div className="flex gap-3">
                              <FormControl>
                                <Input placeholder="e.g. Alex" {...field} className="text-lg py-7 px-5 bg-secondary/30 border-white/5 rounded-2xl focus:bg-secondary/50 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/40" />
                              </FormControl>
                              <Button 
                                type="button"
                                variant={dictating ? "destructive" : "secondary"}
                                size="icon"
                                className={`shrink-0 h-auto w-14 rounded-2xl border border-white/5 ${dictating ? 'animate-pulse shadow-[0_0_20px_rgba(255,0,0,0.3)]' : 'hover:bg-white/10'}`}
                                onClick={() => handleDictate("displayName")}
                              >
                                {dictating ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-foreground" />}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {step === 1 && (
                      <div className="space-y-8">
                        <FormField
                          control={form.control}
                          name="monthlyIncome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-muted-foreground uppercase tracking-wider text-xs font-semibold ml-1">Monthly Income (After Tax)</FormLabel>
                              <div className="relative flex gap-3">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-medium">$</span>
                                <FormControl>
                                  <Input type="number" placeholder="5000" className="pl-10 text-lg py-7 px-5 bg-secondary/30 border-white/5 rounded-2xl focus:bg-secondary/50 focus:ring-primary/30 transition-all" {...field} />
                                </FormControl>
                                <Button type="button" variant={dictating ? "destructive" : "secondary"} size="icon" className={`shrink-0 h-auto w-14 rounded-2xl border border-white/5 ${dictating ? 'animate-pulse' : 'hover:bg-white/10'}`} onClick={() => handleDictate("monthlyIncome")}>
                                  {dictating ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-foreground" />}
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="monthlyExpenses"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-muted-foreground uppercase tracking-wider text-xs font-semibold ml-1">Monthly Expenses</FormLabel>
                              <div className="relative flex gap-3">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-medium">$</span>
                                <FormControl>
                                  <Input type="number" placeholder="3000" className="pl-10 text-lg py-7 px-5 bg-secondary/30 border-white/5 rounded-2xl focus:bg-secondary/50 focus:ring-primary/30 transition-all" {...field} />
                                </FormControl>
                                <Button type="button" variant={dictating ? "destructive" : "secondary"} size="icon" className={`shrink-0 h-auto w-14 rounded-2xl border border-white/5 ${dictating ? 'animate-pulse' : 'hover:bg-white/10'}`} onClick={() => handleDictate("monthlyExpenses")}>
                                  {dictating ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-foreground" />}
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-8">
                        <FormField
                          control={form.control}
                          name="cashSavings"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-muted-foreground uppercase tracking-wider text-xs font-semibold ml-1">Liquid Cash Savings</FormLabel>
                              <div className="relative flex gap-3">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-medium">$</span>
                                <FormControl>
                                  <Input type="number" placeholder="10000" className="pl-10 text-lg py-7 px-5 bg-secondary/30 border-white/5 rounded-2xl focus:bg-secondary/50 focus:ring-primary/30 transition-all" {...field} />
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="otherAssets"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-muted-foreground uppercase tracking-wider text-xs font-semibold ml-1">Other Assets (Stocks, 401k, etc)</FormLabel>
                              <div className="relative flex gap-3">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-medium">$</span>
                                <FormControl>
                                  <Input type="number" placeholder="50000" className="pl-10 text-lg py-7 px-5 bg-secondary/30 border-white/5 rounded-2xl focus:bg-secondary/50 focus:ring-primary/30 transition-all" {...field} />
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="totalDebt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-muted-foreground uppercase tracking-wider text-xs font-semibold ml-1">Total Debt (Excluding Mortgages)</FormLabel>
                              <div className="relative flex gap-3">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-medium">$</span>
                                <FormControl>
                                  <Input type="number" placeholder="15000" className="pl-10 text-lg py-7 px-5 bg-secondary/30 border-white/5 rounded-2xl focus:bg-secondary/50 focus:ring-primary/30 transition-all" {...field} />
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-10">
                        <FormField
                          control={form.control}
                          name="creditScore"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex justify-between items-end mb-6">
                                <FormLabel className="text-muted-foreground uppercase tracking-wider text-xs font-semibold ml-1">Estimated Credit Score</FormLabel>
                                <span className="text-4xl font-serif text-primary tracking-tight">{field.value}</span>
                              </div>
                              <FormControl>
                                <div className="px-2">
                                  <Slider
                                    min={300}
                                    max={850}
                                    step={10}
                                    value={[field.value]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
                                    className="py-4"
                                  />
                                </div>
                              </FormControl>
                              <div className="flex justify-between text-xs text-muted-foreground px-2 font-medium">
                                <span>300 (Poor)</span>
                                <span>850 (Excellent)</span>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="preferredVoice"
                          render={({ field }) => (
                            <FormItem className="space-y-4">
                              <FormLabel className="text-muted-foreground uppercase tracking-wider text-xs font-semibold ml-1">Pepper's Voice</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="flex flex-col sm:flex-row gap-4"
                                >
                                  <FormItem className={`flex items-center space-x-3 space-y-0 p-5 border border-white/5 rounded-2xl flex-1 cursor-pointer transition-all ${field.value === 'female' ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(232,93,63,0.1)]' : 'bg-secondary/30 hover:bg-secondary/50'}`}>
                                    <FormControl>
                                      <RadioGroupItem value="female" className="text-primary border-muted-foreground" />
                                    </FormControl>
                                    <FormLabel className="font-medium cursor-pointer text-foreground">Warm & Professional (Female)</FormLabel>
                                  </FormItem>
                                  <FormItem className={`flex items-center space-x-3 space-y-0 p-5 border border-white/5 rounded-2xl flex-1 cursor-pointer transition-all ${field.value === 'male' ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(232,93,63,0.1)]' : 'bg-secondary/30 hover:bg-secondary/50'}`}>
                                    <FormControl>
                                      <RadioGroupItem value="male" className="text-primary border-muted-foreground" />
                                    </FormControl>
                                    <FormLabel className="font-medium cursor-pointer text-foreground">Calm & Confident (Male)</FormLabel>
                                  </FormItem>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </form>
                </Form>
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0 || updateProfile.isPending}
            className="text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full px-6"
          >
            Back
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={updateProfile.isPending}
            className="rounded-full px-8 h-12 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(232,93,63,0.4)] transition-all font-medium text-base tracking-wide"
          >
            {updateProfile.isPending && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
            {step === steps.length - 1 ? "Initialize Profile" : "Continue"}
            {step === steps.length - 1 ? <Check className="w-5 h-5 ml-2" /> : <ArrowRight className="w-5 h-5 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}