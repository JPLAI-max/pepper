import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { usePepper } from "@/pepper";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, ArrowRight, Loader2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  const { dictateStart, dictateStop, dictating, setVoice } = usePepper();

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
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="mb-8">
        <div className="flex gap-2 mb-4">
          {steps.map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-primary/20'}`} />
          ))}
        </div>
      </div>

      <Card className="border-border/50 shadow-md">
        <CardContent className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h1 className="text-3xl font-serif text-primary mb-2">{steps[step].title}</h1>
                <p className="text-muted-foreground">{steps[step].description}</p>
              </div>

              <Form {...form}>
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  {step === 0 && (
                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input placeholder="e.g. Alex" {...field} className="text-lg py-6" />
                            </FormControl>
                            <Button 
                              type="button"
                              variant={dictating ? "destructive" : "secondary"}
                              size="icon"
                              className={`shrink-0 h-auto w-12 ${dictating ? 'animate-pulse' : ''}`}
                              onClick={() => handleDictate("displayName")}
                            >
                              {dictating ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {step === 1 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="monthlyIncome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Income (After Tax)</FormLabel>
                            <div className="relative flex gap-2">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <FormControl>
                                <Input type="number" placeholder="5000" className="pl-8 text-lg py-6" {...field} />
                              </FormControl>
                              <Button type="button" variant={dictating ? "destructive" : "secondary"} size="icon" className="shrink-0 h-auto w-12" onClick={() => handleDictate("monthlyIncome")}>
                                <Mic className="w-5 h-5" />
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
                            <FormLabel>Monthly Expenses</FormLabel>
                            <div className="relative flex gap-2">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <FormControl>
                                <Input type="number" placeholder="3000" className="pl-8 text-lg py-6" {...field} />
                              </FormControl>
                              <Button type="button" variant={dictating ? "destructive" : "secondary"} size="icon" className="shrink-0 h-auto w-12" onClick={() => handleDictate("monthlyExpenses")}>
                                <Mic className="w-5 h-5" />
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="cashSavings"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Liquid Cash Savings</FormLabel>
                            <div className="relative flex gap-2">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <FormControl>
                                <Input type="number" placeholder="10000" className="pl-8 text-lg py-6" {...field} />
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
                            <FormLabel>Other Assets (Stocks, 401k, etc)</FormLabel>
                            <div className="relative flex gap-2">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <FormControl>
                                <Input type="number" placeholder="50000" className="pl-8 text-lg py-6" {...field} />
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
                            <FormLabel>Total Debt (Excluding Mortgages)</FormLabel>
                            <div className="relative flex gap-2">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <FormControl>
                                <Input type="number" placeholder="15000" className="pl-8 text-lg py-6" {...field} />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-8">
                      <FormField
                        control={form.control}
                        name="creditScore"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex justify-between items-center mb-4">
                              <FormLabel className="text-base">Estimated Credit Score</FormLabel>
                              <span className="text-2xl font-bold text-primary">{field.value}</span>
                            </div>
                            <FormControl>
                              <Slider
                                min={300}
                                max={850}
                                step={10}
                                value={[field.value]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                                className="py-4"
                              />
                            </FormControl>
                            <div className="flex justify-between text-xs text-muted-foreground">
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
                          <FormItem className="space-y-3">
                            <FormLabel className="text-base">Pepper's Voice</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex gap-4"
                              >
                                <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-xl flex-1 cursor-pointer hover:bg-muted/50 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 transition-colors">
                                  <FormControl>
                                    <RadioGroupItem value="female" />
                                  </FormControl>
                                  <FormLabel className="font-medium cursor-pointer">Warm & Professional (Female)</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-xl flex-1 cursor-pointer hover:bg-muted/50 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5 transition-colors">
                                  <FormControl>
                                    <RadioGroupItem value="male" />
                                  </FormControl>
                                  <FormLabel className="font-medium cursor-pointer">Calm & Confident (Male)</FormLabel>
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

      <div className="mt-8 flex justify-between">
        <Button 
          variant="ghost" 
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0 || updateProfile.isPending}
        >
          Back
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={updateProfile.isPending}
          className="rounded-full px-8"
        >
          {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {step === steps.length - 1 ? "Complete Profile" : "Continue"}
          {step === steps.length - 1 ? <Check className="w-4 h-4 ml-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}