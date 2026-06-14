import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  profiles,
  goals,
  roadmapSteps,
  documents,
  type Profile,
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
import { buildCoachContext, computeScores } from "../../lib/insights";

const router: IRouter = Router();

const VOICE_MAP: Record<string, "shimmer" | "onyx"> = {
  female: "shimmer",
  male: "onyx",
};

async function getProfile(): Promise<Profile> {
  const existing = await db.select().from(profiles).limit(1);
  if (existing[0]) return existing[0];
  const created = await db.insert(profiles).values({}).returning();
  return created[0]!;
}

async function buildContextMessages(conversationId: number) {
  const [profile, allGoals, steps, docs, history] = await Promise.all([
    getProfile(),
    db.select().from(goals),
    db
      .select()
      .from(roadmapSteps)
      .orderBy(asc(roadmapSteps.orderIndex)),
    db.select().from(documents),
    db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt)),
  ]);

  const scores = computeScores(profile);
  const system = buildCoachContext(profile, allGoals, scores, steps, docs);

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
  const created = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();
  res.status(201).json(created[0]);
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
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

  const chatMessages = await buildContextMessages(id);
  chatMessages.push({ role: "user", content: parsed.data.content });
  await db
    .insert(messages)
    .values({ conversationId: id, role: "user", content: parsed.data.content });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
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
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
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

    const chatMessages = await buildContextMessages(id);
    chatMessages.push({ role: "user", content: userTranscript });

    let fullResponse = "";
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
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
