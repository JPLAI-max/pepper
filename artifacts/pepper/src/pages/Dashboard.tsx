import React from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetReadinessScores,
  useGetRoadmap,
  useGetOpportunityMatches,
} from "@workspace/api-client-react";
import type {
  ReadinessScore,
  RoadmapPlanStep,
  OpportunityMatch,
} from "@workspace/api-client-react";
import { usePepper } from "@/pepper";
import {
  Sparkles,
  Target,
  Shield,
  FileText,
  ArrowRight,
  Wallet,
  Banknote,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Lock,
  TrendingUp,
  Landmark,
  CandlestickChart,
} from "lucide-react";
import { motion } from "framer-motion";

const DASH_TOKENS: React.CSSProperties = {
  ["--bg" as string]: "#0b0908",
  ["--surface" as string]: "#171210",
  ["--card" as string]: "rgba(28,21,17,.6)",
  ["--accent" as string]: "#ff7e3f",
  ["--amber" as string]: "#ffb454",
  ["--gold" as string]: "#ffd98a",
  ["--success" as string]: "#5fd0a3",
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
.pep-dash .pd-link{color:var(--accent);font-weight:500;display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.pep-dash .pd-link:hover{text-decoration:underline}
.pep-dash .pd-ring{transition:stroke-dashoffset 1s ease-out}
.pep-dash .pd-sec-head{font-family:'Fraunces',Georgia,serif;font-weight:300;letter-spacing:.005em}
.pep-dash .pd-badge{font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;font-weight:700;
  padding:4px 10px;border-radius:999px;border:1px solid var(--line)}
.pep-dash .pd-opp{background:var(--card);border:1px solid var(--line);border-radius:20px;backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);transition:border-color .15s ease,transform .15s ease}
.pep-dash .pd-opp:hover{border-color:rgba(255,180,120,.28)}
.pep-dash .pd-opp.later{opacity:.5}
`;

// Educational band → color/label. Color by the numeric value; the label comes
// from the engine's own tier so the dashboard never invents a band the rest of
// the app doesn't show.
function bandColor(score: number): string {
  if (score >= 80) return "var(--gold)";
  if (score >= 60) return "var(--amber)";
  if (score >= 40) return "var(--accent)";
  return "var(--muted)";
}

// Hero copy is derived from the user's average readiness band — never a static
// "you're on track" claim. With no scores yet we invite them to start.
function heroCopy(avg: number | null): { title: string; sub: string } {
  if (avg === null)
    return {
      title: "Let's build your wealth foundation.",
      sub: "Share your goals and finances with Pepper to generate your readiness scores and a personalized roadmap.",
    };
  if (avg >= 80)
    return {
      title: "Your wealth foundation is strong.",
      sub: "Your readiness is in great shape. Keep the momentum going on your roadmap.",
    };
  if (avg >= 60)
    return {
      title: "You're building real momentum.",
      sub: "Your readiness is climbing. Stay with your roadmap to keep it moving forward.",
    };
  if (avg >= 40)
    return {
      title: "You're making steady progress.",
      sub: "A few focused moves will lift your readiness. Your roadmap shows where to start.",
    };
  return {
    title: "Every step from here builds your wealth.",
    sub: "Let's strengthen the fundamentals first. Your roadmap breaks it into clear, manageable steps.",
  };
}

function RingScore({ score }: { score: ReadinessScore }) {
  const value = score.value ?? score.score;
  const color = bandColor(value);
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <svg className="w-24 h-24" style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="transparent"
            stroke="rgba(255,180,120,.10)"
            strokeWidth="6"
          />
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="transparent"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - value / 100)}
            className="pd-ring"
            style={{ stroke: color }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="pd-num text-2xl" style={{ color }}>
            {value}
          </span>
        </div>
      </div>
      <span className="text-sm mt-2" style={{ color: "var(--ink)", fontWeight: 500 }}>
        {score.label}
      </span>
      <span className="text-xs pd-muted capitalize">
        {(score.band ?? score.tier).replace(/_/g, " ")}
      </span>
    </div>
  );
}

function statusIcon(status: string) {
  if (status === "done")
    return <CheckCircle2 className="w-5 h-5" style={{ color: "var(--success)" }} />;
  if (status === "in_progress")
    return <Clock className="w-5 h-5" style={{ color: "var(--accent)" }} />;
  return <Circle className="w-5 h-5" style={{ color: "var(--muted)" }} />;
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: scores } = useGetReadinessScores();
  const { data: roadmap } = useGetRoadmap();
  const { data: opps } = useGetOpportunityMatches();
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

  const avg =
    scores && scores.length
      ? Math.round(
          scores.reduce((sum, s) => sum + (s.value ?? s.score), 0) /
            scores.length,
        )
      : null;
  const hero = heroCopy(avg);

  const sortedSteps: RoadmapPlanStep[] = roadmap
    ? [...roadmap.steps].sort((a, b) => a.order - b.order)
    : [];
  const nextAction = sortedSteps.find((s) => s.status !== "done") ?? null;

  const matches: OpportunityMatch[] = opps?.matches ?? [];
  const comingLater: OpportunityMatch[] = opps?.comingLater ?? [];

  // Only render money cards whose figure was actually captured.
  const showNetWorth = summary.netWorth !== null;
  const showCashflow = summary.monthlyCashflow !== null;
  const showMoneyRow = showNetWorth || showCashflow;

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
          <h1 className="pd-display text-4xl md:text-5xl mb-4">{hero.title}</h1>
          <p className="pd-muted text-lg mb-8 max-w-2xl leading-relaxed">{hero.sub}</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => setOpen(true)} className="pd-cta">
              <Sparkles className="w-5 h-5" />
              Ask Pepper
            </button>
            {summary.nextStep && (
              <Link href="/roadmap" className="pd-cta-ghost">
                View Next Action{" "}
                <ChevronRight className="w-5 h-5" style={{ color: "var(--muted)" }} />
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Money snapshot — only the figures the user has actually shared */}
      {showMoneyRow && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {showNetWorth && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <div className="pd-card h-full p-7">
                <div
                  className="pd-eyebrow flex items-center gap-2"
                  style={{ letterSpacing: ".12em" }}
                >
                  <Wallet className="w-4 h-4" style={{ color: "var(--gold)" }} />
                  Total Net Worth
                </div>
                <div className="pd-num pos text-4xl md:text-5xl pt-3">
                  ${(summary.netWorth as number).toLocaleString()}
                </div>
                <div className="text-sm pd-muted mt-6 space-y-3">
                  {summary.totalAssets !== null && (
                    <div className="flex justify-between items-center pb-2 pd-divider">
                      <span>Assets</span>
                      <span style={{ color: "var(--ink)" }}>
                        ${summary.totalAssets.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {summary.totalDebt !== null && (
                    <div className="flex justify-between items-center">
                      <span>Debt</span>
                      <span style={{ color: "var(--ink)" }}>
                        ${summary.totalDebt.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {showCashflow && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className="pd-card h-full p-7">
                <div
                  className="pd-eyebrow flex items-center gap-2"
                  style={{ letterSpacing: ".12em" }}
                >
                  <Banknote className="w-4 h-4" style={{ color: "var(--amber)" }} />
                  Monthly Cashflow
                </div>
                <div className="pd-num pos text-4xl md:text-5xl pt-3">
                  ${(summary.monthlyCashflow as number).toLocaleString()}
                </div>
                <p className="text-sm pd-muted mt-6 leading-relaxed">
                  Your monthly income minus expenses — the engine behind every
                  step on your roadmap.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Readiness — all six engine scores, same source as the Readiness page */}
      {scores && scores.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="pd-card p-7 mt-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5" style={{ color: "var(--accent)" }} />
              <h2 className="pd-sec-head text-2xl">Readiness</h2>
            </div>
            <Link href="/readiness" className="pd-link text-sm">
              Analyze readiness <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {scores.map((s) => (
              <RingScore key={s.key} score={s} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Roadmap — live primary obstacle, next action, and step statuses */}
      {roadmap && sortedSteps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="pd-card p-7 mt-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5" style={{ color: "var(--accent)" }} />
              <h2 className="pd-sec-head text-2xl">Your Roadmap</h2>
            </div>
            <Link href="/roadmap" className="pd-link text-sm">
              Open roadmap <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {roadmap.primaryObstacle && (
            <div
              className="flex items-start gap-3 p-4 mb-6 rounded-2xl"
              style={{
                background: "rgba(255,126,63,.08)",
                border: "1px solid var(--line)",
              }}
            >
              <AlertTriangle
                className="w-5 h-5 mt-0.5 shrink-0"
                style={{ color: "var(--accent)" }}
              />
              <div>
                <p className="text-sm" style={{ color: "var(--ink)", fontWeight: 600 }}>
                  Primary focus: {roadmap.primaryObstacle.label}
                </p>
                <p className="text-sm pd-muted mt-1 leading-relaxed">
                  {roadmap.primaryObstacle.detail}
                </p>
              </div>
            </div>
          )}

          {nextAction && (
            <div className="mb-6">
              <div className="pd-eyebrow mb-2" style={{ letterSpacing: ".12em" }}>
                Next action
              </div>
              <p style={{ color: "var(--ink)", fontWeight: 500 }}>{nextAction.action}</p>
              {nextAction.detail && (
                <p className="text-sm pd-muted mt-1 leading-relaxed">
                  {nextAction.detail}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {sortedSteps.slice(0, 5).map((step, i) => (
              <div key={step.id ?? i} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{statusIcon(step.status)}</div>
                <span
                  className="text-sm leading-relaxed"
                  style={{
                    color: step.status === "done" ? "var(--muted)" : "var(--ink)",
                    textDecoration:
                      step.status === "done" ? "line-through" : "none",
                  }}
                >
                  {step.action}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Opportunities — educational matches; future products dimmed */}
      {opps && (matches.length > 0 || comingLater.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="pd-card p-7 mt-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5" style={{ color: "var(--accent)" }} />
              <h2 className="pd-sec-head text-2xl">Opportunities</h2>
            </div>
            <Link href="/opportunities" className="pd-link text-sm">
              Explore all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {matches.map((m) => (
              <div key={m.key} className="pd-opp p-5 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="pd-badge"
                    style={{ color: "var(--accent)", background: "rgba(255,126,63,.08)" }}
                  >
                    {m.category}
                  </span>
                </div>
                <h3 className="text-lg mb-1" style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {m.title}
                </h3>
                <p className="text-sm pd-muted leading-relaxed flex-1">{m.description}</p>
                <p className="text-xs pd-muted mt-3 italic leading-relaxed">{m.rationale}</p>
                <button
                  onClick={() => setOpen(true)}
                  className="pd-link text-sm mt-4 self-start"
                >
                  Ask Pepper about this <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}

            {comingLater.map((m) => (
              <div key={m.key} className="pd-opp later p-5 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="pd-badge"
                    style={{ color: "var(--muted)", background: "rgba(255,180,120,.05)" }}
                  >
                    {m.category}
                  </span>
                  <span className="pd-badge flex items-center gap-1" style={{ color: "var(--muted)" }}>
                    <Lock className="w-3 h-3" /> Coming later
                  </span>
                </div>
                <h3 className="text-lg mb-1" style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {m.title}
                </h3>
                <p className="text-sm pd-muted leading-relaxed flex-1">{m.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Link href="/goals" className="block">
            <div className="pd-card pd-row p-6 md:p-7 flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-5">
                <div className="pd-tile">
                  <Target className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl mb-1" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    Wealth Goals
                  </h3>
                  <p className="text-sm pd-muted flex items-center gap-1.5">
                    <span style={{ color: "var(--gold)", fontWeight: 500 }} className="flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      {summary.achievedGoals} achieved
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Link href="/documents" className="block">
            <div className="pd-card pd-row p-6 md:p-7 flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-5">
                <div className="pd-tile">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl mb-1" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    Document Vault
                  </h3>
                  <p className="text-sm pd-muted">
                    <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                      {summary.documentsComplete}
                    </span>{" "}
                    of {summary.documentsTotal} needed files verified
                  </p>
                </div>
              </div>
              <div className="pd-chev">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Link href="/market" className="block">
            <div className="pd-card pd-row p-6 md:p-7 flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-5">
                <div className="pd-tile">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl mb-1" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    Income Units
                  </h3>
                  <p className="text-sm pd-muted">
                    Explore income participation in operated real estate
                    <span className="pd-badge ml-2" style={{ color: "var(--muted)" }}>
                      Simulation
                    </span>
                  </p>
                </div>
              </div>
              <div className="pd-chev">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <Link href="/financing" className="block">
            <div className="pd-card pd-row p-6 md:p-7 flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-5">
                <div className="pd-tile">
                  <Landmark className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl mb-1" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    Financing
                  </h3>
                  <p className="text-sm pd-muted">
                    Compare loan products matched to your goal
                    <span className="pd-badge ml-2" style={{ color: "var(--muted)" }}>
                      Simulation
                    </span>
                  </p>
                </div>
              </div>
              <div className="pd-chev">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          <Link href="/capital-markets" className="block">
            <div className="pd-card pd-row p-6 md:p-7 flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-5">
                <div className="pd-tile">
                  <CandlestickChart className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl mb-1" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    Capital Markets
                  </h3>
                  <p className="text-sm pd-muted">
                    Funding desk, secondary market, and crypto concepts
                    <span className="pd-badge ml-2" style={{ color: "var(--muted)" }}>
                      Simulation
                    </span>
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
