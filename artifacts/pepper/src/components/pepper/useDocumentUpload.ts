import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  requestUploadUrl,
  ingestDocument,
  confirmDocumentExtraction,
  getGetProfileQueryKey,
  getListDocumentsQueryKey,
  getGetRoadmapQueryKey,
  getGetReadinessScoresQueryKey,
  getGetDashboardSummaryQueryKey,
  type IngestDocumentOutput,
} from "@workspace/api-client-react";

export const ACCEPTED_DOC_TYPES = ["application/pdf", "image/png", "image/jpeg"];
export const MAX_DOC_BYTES = 15 * 1024 * 1024;

/**
 * The shared document upload + parse + confirm flow.
 *
 * Both surfaces that can receive a file — the Pepper chat panel (attach button /
 * panel drop) and the page-level global drop layer — use this hook so the
 * upload → ingest → editable card → confirm pipeline is defined exactly once.
 * Each surface gets its OWN instance: a file is only ever handled by one surface
 * at a time, so there is no shared card to coordinate. Server contract,
 * validation, and query invalidation are identical regardless of entry point.
 */
export function useDocumentUpload() {
  const queryClient = useQueryClient();

  const [uploadPhase, setUploadPhase] = useState<null | "uploading" | "parsing">(null);
  const [card, setCard] = useState<IngestDocumentOutput | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadBusy = uploadPhase !== null || confirming;

  async function handleFile(file: File) {
    setUploadError(null);
    if (!ACCEPTED_DOC_TYPES.includes(file.type)) {
      setUploadError("Only PDF, PNG, or JPG files are supported.");
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setUploadError("That file is too large (15MB max).");
      return;
    }
    setCard(null);
    setEdited({});
    setUploadPhase("uploading");
    try {
      const { uploadURL, objectPath } = await requestUploadUrl({
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const put = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");

      setUploadPhase("parsing");
      const result = await ingestDocument({
        objectPath,
        name: file.name,
        contentType: file.type,
        size: file.size,
      });
      // The document is now filed regardless of whether figures were read.
      void queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      setCard(result);
      setEdited(
        Object.fromEntries(result.fields.map((f) => [f.key, String(f.value)])),
      );
    } catch {
      setUploadError("Something went wrong reading that file. Please try again.");
    } finally {
      setUploadPhase(null);
    }
  }

  async function confirmCard() {
    if (!card) return;
    setConfirming(true);
    setUploadError(null);
    try {
      const payload: Record<string, number> = {};
      for (const f of card.fields) {
        const raw = edited[f.key];
        const n = Number(raw);
        if (raw != null && raw !== "" && Number.isFinite(n)) {
          payload[f.key] = Math.round(n);
        }
      }
      await confirmDocumentExtraction(payload);
      // Confirmed values flow into the profile → refresh everything they touch.
      void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetReadinessScoresQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetRoadmapQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setCard(null);
      setEdited({});
    } catch {
      setUploadError("Could not save those values. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  function discardCard() {
    setCard(null);
    setEdited({});
    setUploadError(null);
  }

  return {
    uploadPhase,
    card,
    edited,
    setEdited,
    confirming,
    uploadError,
    uploadBusy,
    handleFile,
    confirmCard,
    discardCard,
  };
}
