import React from "react";
import { Link } from "wouter";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { usePepper } from "@/pepper";
import { Sparkles, Target, Shield, FileText, ArrowRight, Wallet, Banknote, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const DASH_TOKENS: React.CSSProperties = {
  ["--bg" as string]: "#0b0908",
  ["--surface" as string]: "#171210",
  ["--card" as string]: "rgba(28,21,17,.6)",
  ["--accent" as string]: "#ff7e3f",
  ["--amber" as string]: "#ffb454",
  ["--gold" as string]: "#ffd98a",
  ["--ink" as string]: "#f6ece1",
  ["--muted" as string]: "#a8978a",
  ["--line" as string]: "rgba(255,180,120,.14)",
};

const dashStyles = `
.pep-dash{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--ink);max-width:72rem;margin:0 auto}
.pep-dash .pd-display{font-family:'Fraunces',Georgia,serif;font-weight:300;line-height:1.15;letter-spacing:.005em;color:var(--ink)}
.pep-dash .pd-num{font-family:'Fraunces',Georgia,serif;font-weight:400;letter-spacing:-.01em;color:var(--ink)}
.pep-dash .pd-num.pos{color:var(--gold)}
.pep-dash .pd-eyebrow{font-size:.74rem;letter-spacing:.28em;text-transform:uppercase;color:var(--accent);font-weight:600}
.pep-dash .pd-card{background:var(--card);border:1px solid var(--line);border-radius:22px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.pep-dash .pd-hero{position:relative;overflow:hidden;border-radius:26px;border:1px solid var(--line);
  background:
    radial-gradient(120% 90% at 85% 0%, rgba(255,126,63,.16) 0%, rgba(255,126,63,0) 55%),
    linear-gradient(135deg, rgba(28,21,17,.85), rgba(28,21,17,.45));
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.pep-dash .pd-hero-glow{position:absolute;top:-30%;right:-10%;width:480px;height:480px;border-radius:50%;
  background:radial-gradient(circle, rgba(255,126,63,.18), rgba(255,126,63,0) 70%);pointer-events:none}
.pep-dash .pd-muted{color:var(--muted)}
.pep-dash .pd-cta{display:inline-flex;align-items:center;gap:8px;border:none;cursor:pointer;border-radius:999px;
  padding:14px 28px;font-weight:600;font-size:1rem;font-family:'Inter',sans-serif;
  background:linear-gradient(180deg,var(--amber),var(--accent));color:#3a1606;transition:transform .15s ease,box-shadow .15s ease}
.pep-dash .pd-cta:hover{transform:scale(1.03);box-shadow:0 0 26px rgba(255,126,63,.4)}
.pep-dash .pd-cta-ghost{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:14px 26px;
  font-weight:500;font-size:1rem;color:var(--ink);background:rgba(255,180,120,.06);
  border:1px solid var(--line);transition:background .15s ease}
.pep-dash .pd-cta-ghost:hover{background:rgba(255,180,120,.12)}
.pep-dash .pd-tile{width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;
  background:rgba(255,180,120,.07);border:1px solid var(--line);color:var(--ink)}
.pep-dash .pd-chev{width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;
  background:rgba(255,180,120,.06);color:var(--muted);transition:background .15s ease,color .15s ease}
.pep-dash .pd-row:hover .pd-chev{background:var(--accent);color:#3a1606}
.pep-dash .pd-row{transition:border-color .15s ease,background .15s ease}
.pep-dash .pd-row:hover{border-color:rgba(255,180,120,.28)}
.pep-dash .pd-divider{border-bottom:1px solid var(--line)}
.pep-dash .pd-skel{background:var(--card);border:1px solid var(--line);border-radius:22px;
  animation:pd-pulse 1.6s ease-in-out infinite}
@keyframes pd-pulse{0%,100%{opacity:.5}50%{opacity:.85}}
.pep-dash .pd-link{color:var(--accent);font-weight:500;display:inline-flex;align-items:center;gap:4px}
.pep-dash .pd-link:hover{text-decoration:underline}
`;

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { setOpen } = usePepper();

  if (isLoading) {
    return (
      <div className="pep-dash" style={DASH_TOKENS}>
        <style>{dashStyles}</style>
        <div className="pd-skel" style={{ height: 180 }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="pd-skel" style={{ height: 220 }} />
          <div className="pd-skel" style={{ height: 220 }} />
          <div className="pd-skel" style={{ height: 220 }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="pd-skel" style={{ height: 130 }} />
          <div className="pd-skel" style={{ height: 130 }} />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="pep-dash" style={DASH_TOKENS}>
      <style>{dashStyles}</style>

      {/* Hero / Command Header */}
      <motion.div
        initial={{ opacity: 0, y: 20, filter: "blur(5px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5 }}
        className="pd-hero p-8 md:p-11"
      >
        <div className="pd-hero-glow" />
        <div className="relative z-10">
          <div className="pd-eyebrow flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span>Command Center</span>
          </div>
          <h1 className="pd-display text-4xl md:text-5xl mb-4">Your wealth trajectory is looking strong.</h1>
          <p className="pd-muted text-lg mb-8 max-w-2xl leading-relaxed">
            You are on track. Based on your current cashflow and roadmap, you're ready to take the next step toward your goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => setOpen(true)} className="pd-cta">
              <Sparkles className="w-5 h-5" />
              Ask Pepper
            </button>
            {summary.nextStep && (
              <Link href="/roadmap" className="pd-cta-ghost">
                View Next Action <ChevronRight className="w-5 h-5" style={{ color: "var(--muted)" }} />
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
          <div className="pd-card h-full p-7">
            <div className="pd-eyebrow flex items-center gap-2" style={{ letterSpacing: ".12em" }}>
              <Wallet className="w-4 h-4" style={{ color: "var(--gold)" }} />
              Total Net Worth
            </div>
            <div className="pd-num pos text-4xl md:text-5xl pt-3">${summary.netWorth.toLocaleString()}</div>
            <div className="text-sm pd-muted mt-6 space-y-3">
              <div className="flex justify-between items-center pb-2 pd-divider">
                <span>Assets</span>
                <span style={{ color: "var(--ink)" }}>${summary.totalAssets.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Debt</span>
                <span style={{ color: "var(--ink)" }}>${summary.totalDebt.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
          <div className="pd-card h-full p-7">
            <div className="pd-eyebrow flex items-center gap-2" style={{ letterSpacing: ".12em" }}>
              <Banknote className="w-4 h-4" style={{ color: "var(--amber)" }} />
              Monthly Cashflow
            </div>
            <div className="pd-num pos text-4xl md:text-5xl pt-3">${summary.monthlyCashflow.toLocaleString()}</div>
            <p className="text-sm pd-muted mt-6 leading-relaxed">
              Your monthly income minus expenses. This positive cashflow is the engine for your wealth creation.
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <div className="pd-card h-full p-7">
            <div className="pd-eyebrow flex items-center gap-2" style={{ letterSpacing: ".12em" }}>
              <Shield className="w-4 h-4" style={{ color: "var(--accent)" }} />
              Top Readiness Score
            </div>
            <div className="pd-num text-4xl md:text-5xl pt-3" style={{ color: "var(--accent)" }}>
              {summary.topScore ? summary.topScore.score : 0}
              <span className="text-2xl pd-muted">/100</span>
            </div>
            <p className="text-sm mt-6 mb-1" style={{ color: "var(--ink)", fontWeight: 500 }}>
              {summary.topScore ? summary.topScore.label : "Profile Setup"}
            </p>
            <p className="text-xs pd-muted mb-4">
              {summary.topScore ? "You are in a strong position for this." : "Complete your profile to unlock scores."}
            </p>
            <Link href="/readiness" className="pd-link text-sm">
              Analyze readiness <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
          <Link href="/goals" className="block">
            <div className="pd-card pd-row p-6 md:p-7 flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-5">
                <div className="pd-tile">
                  <Target className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl mb-1" style={{ color: "var(--ink)", fontWeight: 600 }}>Wealth Goals</h3>
                  <p className="text-sm pd-muted flex items-center gap-1.5">
                    <span style={{ color: "var(--gold)", fontWeight: 500 }} className="flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />{summary.achievedGoals} achieved
                    </span>
                    <span style={{ opacity: 0.3 }}>•</span>
                    <span>{summary.activeGoals} active</span>
                  </p>
                </div>
              </div>
              <div className="pd-chev">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
          <Link href="/documents" className="block">
            <div className="pd-card pd-row p-6 md:p-7 flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-5">
                <div className="pd-tile">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl mb-1" style={{ color: "var(--ink)", fontWeight: 600 }}>Document Vault</h3>
                  <p className="text-sm pd-muted">
                    <span style={{ color: "var(--ink)", fontWeight: 500 }}>{summary.documentsComplete}</span> of {summary.documentsTotal} needed files verified
                  </p>
                </div>
              </div>
              <div className="pd-chev">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
