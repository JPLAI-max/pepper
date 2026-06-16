import { z } from "zod/v4";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";
import { ExtractedFinancials } from "./extraction";

// Vision-capable model. Documents are parsed rarely (one per upload), so this
// can be a touch stronger than the per-turn conversation extractor.
const DOC_MODEL = process.env.DOC_EXTRACT_MODEL ?? "gpt-4o-mini";

export const DOCUMENT_TYPES = [
  "w2",
  "pay_stub",
  "bank_statement",
  "tax_return",
  "credit_report",
  "property_doc",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  w2: "W-2",
  pay_stub: "pay stub",
  bank_statement: "bank statement",
  tax_return: "tax return",
  credit_report: "credit report",
  property_doc: "property document",
  other: "document",
};

export function docTypeLabel(t: string): string {
  return DOC_TYPE_LABELS[t as DocumentType] ?? "document";
}

const DOC_CATEGORY: Record<DocumentType, string> = {
  w2: "Income",
  pay_stub: "Income",
  tax_return: "Income",
  bank_statement: "Assets",
  credit_report: "Credit",
  property_doc: "Property",
  other: "Other",
};

export function docCategory(t: string): string {
  return DOC_CATEGORY[t as DocumentType] ?? "Other";
}

const DOC_SYSTEM_PROMPT = `You are reading a single personal financial document for a wealth coach. Do TWO things and return ONLY JSON in the exact shape below.

1. Classify the document's type as one of exactly: "w2", "pay_stub", "bank_statement", "tax_return", "credit_report", "property_doc", "other".

2. Extract ONLY the financial values that are actually printed in this document. This is critical: NEVER invent, estimate, infer, or annualize a number that is not explicitly shown. If a value is not clearly present, leave it null. Do not guess.

Mapping guidance:
- income.annual: an explicitly stated annual/yearly gross wage (e.g. W-2 box 1, tax return total income).
- income.monthly: an explicitly stated monthly/per-period gross amount (e.g. a pay stub's gross pay for the period only if it is clearly monthly).
- assets.cash / assets.savings: account balances shown on a bank statement.
- debt.credit_cards / debt.auto / debt.student / debt.personal: outstanding balances shown on a credit report or statement.
- credit.score_estimate: a credit score explicitly printed on a credit report.
Leave everything you do not see as null. Use whole numbers (no currency symbols or commas).

Return ONLY this JSON shape:
{
  "doc_type": "w2" | "pay_stub" | "bank_statement" | "tax_return" | "credit_report" | "property_doc" | "other",
  "extracted": {
    "income": { "annual": null, "monthly": null, "employment_type": null },
    "assets": { "cash": null, "savings": null, "retirement": null },
    "debt": { "credit_cards": null, "auto": null, "student": null, "personal": null },
    "credit": { "score_estimate": null },
    "spending": { "housing": null, "transportation": null, "dining": null, "subscriptions": null }
  }
}`;

const DocResult = z.object({
  doc_type: z.string().nullable().optional(),
  extracted: ExtractedFinancials,
});

export interface DocumentParseResult {
  docType: DocumentType;
  extracted: z.infer<typeof ExtractedFinancials>;
}

function normalizeDocType(raw: string | null | undefined): DocumentType {
  const t = (raw ?? "").toLowerCase().trim();
  return (DOCUMENT_TYPES as readonly string[]).includes(t)
    ? (t as DocumentType)
    : "other";
}

/**
 * Send a stored financial document to the vision model to (a) classify its type
 * and (b) extract only the financial values actually present. Returns a
 * structured result reusing the shared ExtractedFinancials shape so it persists
 * through the exact same profile-mapping path as the conversation extractor.
 * Never throws into the caller: a parse failure yields { docType: "other",
 * extracted: undefined }.
 */
export async function classifyAndExtractDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<DocumentParseResult> {
  const base64 = buffer.toString("base64");

  // PNG/JPG go in as an image; PDF goes in as a file content part.
  const userContent =
    mimeType === "application/pdf"
      ? [
          { type: "text" as const, text: "Read this document and return the JSON." },
          {
            type: "file" as const,
            file: {
              filename: "document.pdf",
              file_data: `data:application/pdf;base64,${base64}`,
            },
          },
        ]
      : [
          { type: "text" as const, text: "Read this document and return the JSON." },
          {
            type: "image_url" as const,
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ];

  try {
    const completion = await openai.chat.completions.create({
      model: DOC_MODEL,
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: DOC_SYSTEM_PROMPT },
        // Cast: the OpenAI types model content parts narrowly; the proxy accepts
        // image_url and file parts on vision models.
        { role: "user", content: userContent as never },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { docType: "other", extracted: undefined };

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      logger.warn("Document parse returned non-JSON content");
      return { docType: "other", extracted: undefined };
    }

    const parsed = DocResult.safeParse(json);
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues }, "Document parse failed validation");
      return { docType: "other", extracted: undefined };
    }

    return {
      docType: normalizeDocType(parsed.data.doc_type),
      extracted: parsed.data.extracted,
    };
  } catch (err) {
    logger.warn({ err }, "Document parse call failed");
    return { docType: "other", extracted: undefined };
  }
}
