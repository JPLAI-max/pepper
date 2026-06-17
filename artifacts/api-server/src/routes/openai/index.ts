import { Router, type IRouter, type Request } from "express";
import { asc, eq } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  goals,
  roadmapSteps,
  documents,
} from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  SendOpenaiVoiceMessageBody,
  TranscribeOpenaiAudioBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  speechToText,
  textToSpeech,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import {
  buildCoachContext,
  computeScores,
  GUEST_PROFILE,
} from "../../lib/insights";
import { getOrCreateProfile } from "../../lib/identity";
import { getSessionUserId } from "../../lib/auth";
import { extractAndPersist } from "../../lib/extraction";
import { classifyOverlayIntent, TOUR_STOPS } from "../../lib/navigation";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

// Coach chat model. Env-driven so we can roll forward without a code change;
// defaults to a known-valid current model. Never hardcode a non-existent id.
const COACH_MODEL = process.env.COACH_MODEL ?? "gpt-4o";

const VOICE_MAP: Record<string, "shimmer" | "onyx"> = {
  female: "shimmer",
  male: "onyx",
};

/**
 * Detect when an anonymous user is about to hand over personal financial
 * specifics (a dollar amount, a credit score, or income/debt/savings talk with
 * a number). Used only to decide whether to surface the account-setup prompt —
 * never to block the conversation.
 */
function mentionsFinancialSpecifics(text: string): boolean {
  const t = text.toLowerCase();
  const hasMoney = /\$\s?\d|\b\d{2,}\s?k\b|\b\d{3,}\b/.test(t);
  const creditScore = /credit\s*score|fico/.test(t);
  const topicWithNumber =
    /(income|salary|make|earn|debt|owe|loan|savings?|save|mortgage|rent|paycheck|401k|invest)/.test(
      t,
    ) && /\d/.test(t);
  return hasMoney || creditScore || topicWithNumber;
}

/**
 * Resolve who (if anyone) may act on a conversation. An owned conversation is
 * accessible only to its owner's session; an anonymous conversation is
 * accessible only to the browser session that created it (bound via
 * session.conversationId). Returns null when access is denied.
 */
async function resolveConversationAccess(
  req: Request,
  conversationId: number,
): Promise<{ userId: number | null } | null> {
  const conv = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv[0]) return null;

  const sessionUserId = getSessionUserId(req);
  if (conv[0].userId != null) {
    // Owned conversation: only the owner's session may touch it.
    return sessionUserId === conv[0].userId ? { userId: conv[0].userId } : null;
  }
  // Anonymous conversation: only the session that created it may touch it.
  return req.session.conversationId === conversationId ? { userId: null } : null;
}

/**
 * Fire-and-forget the silent extraction pass for a finished user turn. Only
 * persists for authenticated users — anonymous data is never written. Never
 * touches the response stream and never throws into the request.
 */
function scheduleExtraction(conversationId: number, userId: number | null): void {
  if (userId == null) return;
  void (async () => {
    try {
      await extractAndPersist(conversationId, userId);
    } catch (err) {
      logger.error({ err, conversationId }, "Silent extraction failed");
    }
  })();
}

async function buildContextMessages(
  conversationId: number,
  userId: number | null,
  opts: {
    overlay?: boolean;
    section?: string;
    navigateTo?: string;
    tour?: boolean;
  } = {},
) {
  const isGuest = userId == null;
  const [profile, allGoals, steps, docs, history] = await Promise.all([
    isGuest ? Promise.resolve(GUEST_PROFILE) : getOrCreateProfile(userId),
    isGuest
      ? Promise.resolve([])
      : db.select().from(goals).where(eq(goals.userId, userId)),
    isGuest
      ? Promise.resolve([])
      : db
          .select()
          .from(roadmapSteps)
          .where(eq(roadmapSteps.userId, userId))
          .orderBy(asc(roadmapSteps.orderIndex)),
    isGuest
      ? Promise.resolve([])
      : db.select().from(documents).where(eq(documents.userId, userId)),
    db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt)),
  ]);

  const scores = computeScores(profile);
  const system = buildCoachContext(profile, allGoals, scores, steps, docs, {
    isGuest,
    overlay: opts.overlay,
    section: opts.section,
    navigateTo: opts.navigateTo,
    tour: opts.tour,
  });

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] =
    [{ role: "system", content: system }];
  for (const m of history) {
    if (m.role === "user" || m.role === "assistant") {
      chatMessages.push({ role: m.role, content: m.content });
    }
  }
  return chatMessages;
}

router.post("/openai/conversations", async (req, res) => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid conversation data" });
    return;
  }
  const userId = getSessionUserId(req);
  const created = await db
    .insert(conversations)
    .values({ title: parsed.data.title, userId: userId ?? null })
    .returning();
  // Anonymous conversation: bind it to this browser session so the guest's
  // chat is private to them and can be claimed at signup. Writing to the
  // session issues the cookie.
  if (userId == null) {
    req.session.conversationId = created[0]!.id;
  }
  res.status(201).json(created[0]);
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const access = await resolveConversationAccess(req, id);
  if (!access) {
    res.status(403).json({ error: "Not your conversation" });
    return;
  }
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json(rows);
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = SendOpenaiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }
  const access = await resolveConversationAccess(req, id);
  if (!access) {
    res.status(403).json({ error: "Not your conversation" });
    return;
  }

  const overlay = parsed.data.mode === "overlay";
  // Overlay (Mode B) may resolve a spoken/typed request like "take me to the
  // trading desk" into an allowlisted in-app route, OR "give me the tour" into
  // the guided demo walkthrough. Resolving it before we build the coach context
  // lets Pepper acknowledge it by name. The allowlist (routes AND tour stops) is
  // enforced server-side (see lib/navigation) — never an arbitrary path or URL.
  const intent = overlay
    ? await classifyOverlayIntent(parsed.data.content)
    : { navigate: null, tour: false };
  const navigateTo = intent.navigate;
  const startTour = intent.tour;
  const chatMessages = await buildContextMessages(id, access.userId, {
    overlay,
    section: parsed.data.section,
    navigateTo: navigateTo ?? undefined,
    tour: startTour,
  });
  chatMessages.push({ role: "user", content: parsed.data.content });
  await db
    .insert(messages)
    .values({ conversationId: id, role: "user", content: parsed.data.content });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Trust gate: an anonymous user sharing financial specifics gets nudged to
  // set up an account so we can save their roadmap. The chat still proceeds.
  if (access.userId == null && mentionsFinancialSpecifics(parsed.data.content)) {
    res.write(`data: ${JSON.stringify({ authRequired: true })}\n\n`);
  }

  let fullResponse = "";
  try {
    const stream = await openai.chat.completions.create({
      model: COACH_MODEL,
      max_completion_tokens: 4096,
      messages: chatMessages,
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
  } catch (err) {
    req.log.error({ err }, "Chat stream failed");
    res.write(
      `data: ${JSON.stringify({ error: "Pepper hit a snag. Please try again." })}\n\n`,
    );
  }

  if (fullResponse) {
    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });
  }

  // Persistence policy:
  // - Overlay (Mode B): only a confirmed fill (commit === true) writes. We run
  //   the existing auth-scoped extraction pass AWAITED — before `done` — so the
  //   client's post-turn query invalidation sees the recomputed scores/roadmap.
  //   Explain/proposal turns (no commit) never touch the DB.
  // - Non-overlay (Mode A): unchanged fire-and-forget extraction after `end`.
  if (overlay) {
    if (parsed.data.commit === true && access.userId != null) {
      try {
        await extractAndPersist(id, access.userId);
      } catch (err) {
        req.log.error({ err, conversationId: id }, "Overlay commit extraction failed");
      }
    }
    // Tour takes priority over a single-route navigation. The server owns the
    // ordered, allowlisted stops the tour cycles through.
    if (startTour) {
      res.write(`data: ${JSON.stringify({ tour: { stops: TOUR_STOPS } })}\n\n`);
    } else if (navigateTo) {
      res.write(`data: ${JSON.stringify({ navigate: navigateTo })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();

  // Silent, out-of-band extraction. Authenticated users only.
  scheduleExtraction(id, access.userId);
});

router.post("/openai/conversations/:id/voice-messages", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = SendOpenaiVoiceMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid voice message" });
    return;
  }
  const access = await resolveConversationAccess(req, id);
  if (!access) {
    res.status(403).json({ error: "Not your conversation" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const audioBuffer = Buffer.from(parsed.data.audio, "base64");
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
    const userTranscript = await speechToText(buffer, format);

    res.write(
      `data: ${JSON.stringify({ type: "user_transcript", data: userTranscript })}\n\n`,
    );

    // Trust gate for voice: nudge anonymous users to set up an account when
    // they speak financial specifics.
    if (access.userId == null && mentionsFinancialSpecifics(userTranscript)) {
      res.write(`data: ${JSON.stringify({ type: "auth_required" })}\n\n`);
    }

    const chatMessages = await buildContextMessages(id, access.userId);
    chatMessages.push({ role: "user", content: userTranscript });

    let fullResponse = "";
    const stream = await openai.chat.completions.create({
      model: COACH_MODEL,
      max_completion_tokens: 2048,
      messages: chatMessages,
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: "transcript", data: content })}\n\n`);
      }
    }

    const voice = VOICE_MAP[parsed.data.voice ?? "female"] ?? "shimmer";
    if (fullResponse) {
      const speech = await textToSpeech(fullResponse, voice, "mp3");
      res.write(
        `data: ${JSON.stringify({ type: "audio", data: speech.toString("base64") })}\n\n`,
      );
    }

    const rows = [
      { conversationId: id, role: "user", content: userTranscript },
    ];
    if (fullResponse) {
      rows.push({ conversationId: id, role: "assistant", content: fullResponse });
    }
    await db.insert(messages).values(rows);
  } catch (err) {
    req.log.error({ err }, "Voice message failed");
    res.write(
      `data: ${JSON.stringify({ type: "error", data: "Pepper couldn't hear that clearly. Please try again." })}\n\n`,
    );
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();

  // Silent, out-of-band extraction. Authenticated users only.
  scheduleExtraction(id, access.userId);
});

router.post("/openai/transcribe", async (req, res) => {
  const parsed = TranscribeOpenaiAudioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid audio" });
    return;
  }
  try {
    const audioBuffer = Buffer.from(parsed.data.audio, "base64");
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
    const text = await speechToText(buffer, format);
    res.json({ text });
  } catch (err) {
    req.log.error({ err }, "Transcription failed");
    res.status(500).json({ error: "Could not transcribe audio" });
  }
});

export default router;
