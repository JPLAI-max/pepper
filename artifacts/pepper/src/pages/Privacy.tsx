import { Link } from "wouter";
import { ArrowLeft, Lock, Shield, EyeOff, KeyRound } from "lucide-react";

const POINTS = [
  {
    icon: KeyRound,
    title: "Passkeys, not passwords you can lose",
    body: "When you continue with Face ID, a passkey is created on your own device. The private key never leaves it — we only ever store a public key, so there's no password for anyone to steal.",
  },
  {
    icon: Lock,
    title: "Private to you alone",
    body: "Your goals, numbers, documents, and roadmap are tied to your account and readable only when you're signed in. No one else can open your workspace.",
  },
  {
    icon: EyeOff,
    title: "We never sell your data",
    body: "Pepper does not sell or rent your personal or financial information. Your details are used to coach you — nothing else.",
  },
  {
    icon: Shield,
    title: "Verified on our servers",
    body: "Every sign-in is checked on our side with a single-use challenge, so a login can't be replayed or forged.",
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="mt-10">
          <h1 className="font-serif text-4xl mb-3">How we protect it</h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl">
            Pepper is built so your financial life stays yours. Here's exactly
            how your information is kept private and secure.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 flex gap-4"
            >
              <div className="shrink-0 w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-medium mb-1.5">{title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 text-xs text-muted-foreground/70 leading-relaxed">
          This page explains our approach in plain language. Questions about your
          data are always welcome — just ask Pepper.
        </p>
      </div>
    </div>
  );
}
