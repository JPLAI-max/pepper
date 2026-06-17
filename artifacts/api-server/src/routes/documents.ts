import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, documents, type Profile } from "@workspace/db";
import {
  CreateDocumentBody,
  UpdateDocumentBody,
  IngestDocumentBody,
  ConfirmDocumentExtractionBody,
} from "@workspace/api-zod";
import { getSessionUserId, requireAuth } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { getObjectAclPolicy } from "../lib/objectAcl";
import { mapToProfileFields, persistProfileFields } from "../lib/extraction";
import {
  classifyAndExtractDocument,
  docCategory,
  docTypeLabel,
} from "../lib/documentExtraction";

const router: IRouter = Router();

const objectStorageService = new ObjectStorageService();

// Server-side upload guardrails. Financial PII only — accept the three formats
// Pepper can actually read, and cap size so a huge file can't be filed.
const ALLOWED_DOC_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
const MAX_DOC_BYTES = 15 * 1024 * 1024;

const PROPOSED_FIELD_LABELS: Record<string, string> = {
  monthlyIncome: "Monthly income",
  monthlyExpenses: "Monthly expenses",
  cashSavings: "Cash & savings",
  otherAssets: "Other assets",
  totalDebt: "Total debt",
  creditScore: "Credit score",
};

router.get("/documents", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(asc(documents.orderIndex), asc(documents.createdAt));
  res.json(rows);
});

router.post("/documents", requireAuth, async (req, res) => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document data" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const created = await db
    .insert(documents)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(created[0]);
});

router.patch("/documents/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document data" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const updated = await db
    .update(documents)
    .set(parsed.data)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(updated[0]);
});

router.delete("/documents/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const deleted = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();
  if (!deleted[0]) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.status(204).end();
});

/**
 * Finalize an in-conversation document upload. The file was already PUT to a
 * presigned private-bucket URL; here we (1) re-validate the ACTUAL stored
 * object's type and size (the client's declared values are advisory), (2) lock
 * it to its owner with a private ACL so the serve route can authorize it, (3)
 * file a userId-scoped documents row, and (4) parse it server-side into
 * PROPOSED values for the user to confirm. NOTHING is written to the profile
 * here — that only happens on explicit confirmation.
 */
router.post("/documents/ingest", requireAuth, async (req, res) => {
  const parsed = IngestDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid upload metadata" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const { objectPath, name, contentType, size } = parsed.data;

  // NOTE: we do NOT fast-reject on the declared type/size here. The file was
  // already PUT to storage, so any rejection must also delete the stored
  // object. Deletion is only safe AFTER the ownership guard below, so all
  // type/size validation (which falls back to the declared values when the
  // stored metadata is absent) is deferred until then.
  let objectFile;
  try {
    objectFile = await objectStorageService.getObjectEntityFile(objectPath);
  } catch {
    res.status(400).json({ error: "Uploaded file could not be found." });
    return;
  }

  // Ownership guard: a freshly presigned upload carries no ACL yet, so a null
  // policy is the expected case. If the object ALREADY has an owner that isn't
  // this user, refuse — never rebind a foreign object's ACL or delete it. This
  // closes object-takeover via a guessed/leaked object path.
  const existingAcl = await getObjectAclPolicy(objectFile);
  if (existingAcl && existingAcl.owner !== String(userId)) {
    res.status(403).json({ error: "You don't have access to that file." });
    return;
  }

  // Authoritative re-validation against what was actually stored.
  const [metadata] = await objectFile.getMetadata();
  const actualType = (metadata.contentType as string) || contentType;
  const actualSize = metadata.size != null ? Number(metadata.size) : size;
  if (
    !ALLOWED_DOC_TYPES.has(actualType) ||
    !Number.isFinite(actualSize) ||
    actualSize <= 0 ||
    actualSize > MAX_DOC_BYTES
  ) {
    try {
      await objectFile.delete();
    } catch {
      /* best-effort cleanup */
    }
    res
      .status(400)
      .json({ error: "Only PDF, PNG, or JPG files up to 15MB are supported." });
    return;
  }

  // Lock the object to its owner: private + owner ACL. Without a policy the
  // serve route's canAccessObjectEntity returns false → 403, so this is what
  // makes the owner (and only the owner) able to read it back.
  try {
    await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
      owner: String(userId),
      visibility: "private",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to set document ACL");
    res.status(500).json({ error: "Could not secure the uploaded file." });
    return;
  }

  // Parse server-side: classify the type and extract only present values.
  const buffer = (await objectFile.download())[0];
  const { docType, extracted } = await classifyAndExtractDocument(
    buffer,
    actualType,
  );

  // File the document in the owner's vault, keyed to the stored object.
  const created = await db
    .insert(documents)
    .values({
      userId,
      name,
      category: docCategory(docType),
      status: "complete",
      fileUrl: objectPath,
      mimeType: actualType,
      sizeBytes: actualSize,
      uploadedAt: new Date(),
    })
    .returning();
  const documentId = created[0]!.id;

  // Map the extracted facts to PROPOSED profile values. Annual→monthly
  // derivation is disabled here: a document may only surface figures literally
  // printed on it (aggregates are still sums of stated line items, never guesses).
  const mapped = mapToProfileFields(extracted, { deriveMonthlyFromAnnual: false });
  const fields = (Object.keys(PROPOSED_FIELD_LABELS) as Array<keyof Profile>)
    .filter((k) => typeof mapped[k] === "number")
    .map((k) => ({
      key: k as string,
      label: PROPOSED_FIELD_LABELS[k as string]!,
      value: mapped[k] as number,
    }));

  const label = docTypeLabel(docType);
  res.json({
    documentId,
    docType,
    docTypeLabel: label,
    fields,
    ...(fields.length === 0
      ? {
          message: `I've filed your ${label}, but I couldn't read any clear figures from it. You can tell me the numbers directly.`,
        }
      : {}),
  });
});

/**
 * Persist user-confirmed (and possibly edited) document values onto the user's
 * OWN profile through the shared persistence path — which validates, diffs,
 * logs history, and recomputes scores + roadmap. Only the whitelisted numeric
 * profile fields are accepted; nothing else can be written here.
 */
router.post("/documents/confirm-extraction", requireAuth, async (req, res) => {
  const parsed = ConfirmDocumentExtractionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid values" });
    return;
  }
  const userId = getSessionUserId(req)!;

  const mapped: Partial<Profile> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      (mapped[k as keyof Profile] as number) = Math.round(v);
    }
  }

  const updatedFields = await persistProfileFields(userId, mapped, {
    source: "document-confirm",
  });
  res.json({ updatedFields });
});

export default router;
