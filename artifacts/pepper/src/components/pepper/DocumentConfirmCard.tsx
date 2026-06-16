import React from "react";
import { FileText, Check, X as XIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import type { IngestDocumentOutput } from "@workspace/api-client-react";

/**
 * The editable confirmation card for a parsed document. Shown identically in the
 * Pepper chat panel and the global drop layer. Nothing is written to the profile
 * until the user presses "Save to my profile" — the parent owns the actual
 * confirm/discard calls (via useDocumentUpload).
 */
export function DocumentConfirmCard({
  card,
  edited,
  setEdited,
  confirming,
  onConfirm,
  onDiscard,
}: {
  card: IngestDocumentOutput;
  edited: Record<string, string>;
  setEdited: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  confirming: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 backdrop-blur-sm shadow-[0_0_24px_rgba(232,93,63,0.08)]"
    >
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          I read your {card.docTypeLabel}
        </span>
      </div>

      {card.fields.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Review and edit these before I save them. I only filled in what I could read.
          </p>
          <div className="space-y-2.5">
            {card.fields.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <div className="relative">
                  {f.key !== "creditScore" && (
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70">$</span>
                  )}
                  <input
                    type="number"
                    inputMode="numeric"
                    value={edited[f.key] ?? ""}
                    onChange={(e) =>
                      setEdited((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    className={`w-28 bg-background/60 border border-border/60 rounded-lg py-1.5 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary/50 ${f.key === "creditScore" ? "px-2.5" : "pl-5 pr-2.5"}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button
              type="button"
              size="sm"
              onClick={onConfirm}
              disabled={confirming}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Save to my profile
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onDiscard}
              disabled={confirming}
              className="text-muted-foreground hover:text-foreground rounded-xl"
            >
              <XIcon className="w-4 h-4 mr-1" />
              Discard
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            {card.message ?? "I filed it, but couldn't read any clear figures. You can tell me the numbers directly."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDiscard}
            className="text-muted-foreground hover:text-foreground rounded-xl"
          >
            Dismiss
          </Button>
        </>
      )}
    </motion.div>
  );
}
