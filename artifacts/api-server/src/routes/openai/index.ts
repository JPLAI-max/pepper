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
  GOAL_CATEGORIES,
  type Profile,
  type Goal,
} from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  SendOpenaiVoiceMessageBody,
  TranscribeOpenaiAudioBody,
  SendDiscoveryMessageBody,
  SpeakTextBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  speechToText,
  textToSpeech,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import {
  buildCoachContext,
  buildDiscoveryContext,
  computeScores,
} from "../../lib/insights";

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

const DISCOVERY_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "update_profile",
      description:
        "Save financial facts the user shares, as soon as you learn them. Only include fields the user actually told you. All money values are whole US dollars (no cents).",
      parameters: {
        type: "object",
        properties: {
          displayName: {
            type: "string",
            description: "What the user wants to be called (their first name).",
          },
          monthlyIncome: {
            type: "integer",
            description: "Monthly income in whole dollars.",
          },
          monthlyExpenses: {
            type: "integer",
            description: "Total monthly spending in whole dollars.",
          },
          cashSavings: {
            type: "integer",
            description: "Cash and savings on hand in whole dollars.",
          },
          otherAssets: {
            type: "integer",
            description:
              "Investments, home equity, and other assets in whole dollars.",
          },
          totalDebt: {
            type: "integer",
            description: "Total outstanding debt in whole dollars (0 if none).",
          },
          creditScore: {
            type: "integer",
            description: "Credit score between 300 and 850.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_primary_goal",
      description:
        "Record or update the user's primary financial goal once you understand what they want to accomplish.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short human title, e.g. 'Buy my first home'.",
          },
          category: {
            type: "string",
            enum: [...GOAL_CATEGORIES],
          },
          targetAmount: {
            type: "integer",
            description: "Dollar amount needed, if known (0 if unknown).",
          },
          targetDate: {
            type: "string",
            description:
              "Approximate target date (ISO yyyy-mm-dd or a year) if mentioned.",
          },
        },
        required: ["title", "category"],
        additionalProperties: false,
      },
    },
  },
];

function clampInt(n: unknown, min: number, max: number): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function applyProfileUpdate(
  profile: Profile,
  args: Record<string, unknown>,
): Promise<Profile> {
  const patch: Record<string, unknown> = {};
  if (typeof args.displayName === "string" && args.displayName.trim()) {
    patch.displayName = args.displayName.trim().slice(0, 80);
  }
  const income = clampInt(args.monthlyIncome, 0, 100_000_000);
  if (income !== null) patch.monthlyIncome = income;
  const expenses = clampInt(args.monthlyExpenses, 0, 100_000_000);
  if (expenses !== null) patch.monthlyExpenses = expenses;
  const cash = clampInt(args.cashSavings, 0, 1_000_000_000);
  if (cash !== null) patch.cashSavings = cash;
  const assets = clampInt(args.otherAssets, 0, 1_000_000_000);
  if (assets !== null) patch.otherAssets = assets;
  const debt = clampInt(args.totalDebt, 0, 1_000_000_000);
  if (debt !== null) patch.totalDebt = debt;
  const credit = clampInt(args.creditScore, 0, 850);
  if (credit !== null) patch.creditScore = credit;

  if (Object.keys(patch).length === 0) return profile;
  patch.updatedAt = new Date();
  const updated = await db
    .update(profiles)
    .set(patch)
    .where(eq(profiles.id, profile.id))
    .returning();
  return updated[0] ?? profile;
}

async function applyGoalUpdate(args: Record<string, unknown>): Promise<void> {
  const title =
    typeof args.title === "string" ? args.title.trim().slice(0, 120) : "";
  if (!title) return;
  const category =
    typeof args.category === "string" &&
    (GOAL_CATEGORIES as readonly string[]).includes(args.category)
      ? args.category
      : "wealth";
  const targetAmount = clampInt(args.targetAmount, 0, 1_000_000_000) ?? 0;
  const targetDate =
    typeof args.targetDate === "string" && args.targetDate.trim()
      ? args.targetDate.trim().slice(0, 40)
      : null;

  const existing = await db.select().from(goals).orderBy(asc(goals.priority));
  if (existing[0]) {
    await db
      .update(goals)
      .set({ title, category, targetAmount, targetDate, status: "active" })
      .where(eq(goals.id, existing[0].id));
  } else {
    await db.insert(goals).values({
      title,
      category,
      targetAmount,
      targetDate,
      status: "active",
      priority: 0,
    });
  }
}

function computeChecklist(p: Profile, goalsList: Goal[]) {
  return {
    goal: goalsList.length > 0,
    income: p.monthlyIncome > 0,
    expenses: p.monthlyExpenses > 0,
    savings: p.cashSavings > 0 || p.otherAssets > 0,
    debt: p.totalDebt > 0,
    credit: p.creditScore > 0,
    timeline: goalsList.some((g) => !!g.targetDate),
  };
}

router.post("/openai/discovery", async (req, res) => {
  const parsed = SendDiscoveryMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid discovery message" });
    return;
  }
  const { conversationId, content } = parsed.data;

  try {
    let profile = await getProfile();
    await db.insert(messages).values({ conversationId, role: "user", content });

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
    let goalsList = await db.select().from(goals).orderBy(asc(goals.priority));
    const checklist = computeChecklist(profile, goalsList);
    const system = buildDiscoveryContext(profile, goalsList, checklist);

    const chatMessages: any[] = [{ role: "system", content: system }];
    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        chatMessages.push({ role: m.role, content: m.content });
      }
    }

    const first = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      messages: chatMessages,
      tools: DISCOVERY_TOOLS,
      tool_choice: "auto",
    });
    const msg = first.choices[0]?.message;
    const toolCalls = msg?.tool_calls ?? [];

    let reply = msg?.content ?? "";
    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        if (tc.type !== "function") continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        if (tc.function.name === "update_profile") {
          profile = await applyProfileUpdate(profile, args);
        } else if (tc.function.name === "set_primary_goal") {
          await applyGoalUpdate(args);
        }
      }
      chatMessages.push({
        role: "assistant",
        content: msg?.content ?? "",
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        chatMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: "saved",
        });
      }
      const second = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 1024,
        messages: chatMessages,
      });
      reply = second.choices[0]?.message?.content ?? reply;
    }

    if (reply) {
      await db
        .insert(messages)
        .values({ conversationId, role: "assistant", content: reply });
    }

    profile = await getProfile();
    goalsList = await db.select().from(goals).orderBy(asc(goals.priority));
    const finalChecklist = computeChecklist(profile, goalsList);
    const knownCount = Object.values(finalChecklist).filter(Boolean).length;
    const readyForReveal =
      finalChecklist.goal && finalChecklist.income && knownCount >= 4;

    res.json({
      reply,
      profile,
      goal: goalsList[0] ?? null,
      checklist: finalChecklist,
      readyForReveal,
    });
  } catch (err) {
    req.log.error({ err }, "Discovery turn failed");
    res.status(500).json({ error: "Pepper hit a snag. Please try again." });
  }
});

router.post("/openai/speak", async (req, res) => {
  const parsed = SpeakTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid speak request" });
    return;
  }
  try {
    const voice = VOICE_MAP[parsed.data.voice ?? "female"] ?? "shimmer";
    const speech = await textToSpeech(parsed.data.text, voice, "mp3");
    res.json({ audio: speech.toString("base64") });
  } catch (err) {
    req.log.error({ err }, "Speak failed");
    res.status(500).json({ error: "Could not generate audio" });
  }
});

router.post("/openai/generate-roadmap", async (req, res) => {
  try {
    const profile = await getProfile();
    const goalsList = await db.select().from(goals).orderBy(asc(goals.priority));
    const scores = computeScores(profile);
    const goal = goalsList[0];

    const system =
      "You are Pepper, an expert wealth strategist. Create a concrete, personalized, sequential roadmap that moves this user toward their primary goal, tackling their weakest readiness areas first. Each step must be specific and actionable, not generic advice. Return ONLY JSON.";
    const scoreLines = scores
      .map((s) => `- ${s.label}: ${s.score}/100 (${s.tier})`)
      .join("\n");
    const ctx = `PRIMARY GOAL: ${
      goal ? `${goal.title} (${goal.category}), target $${goal.targetAmount}, by ${goal.targetDate ?? "unspecified"}` : "not set"
    }
FINANCES (whole dollars): income ${profile.monthlyIncome}/mo, spending ${profile.monthlyExpenses}/mo, cash ${profile.cashSavings}, other assets ${profile.otherAssets}, debt ${profile.totalDebt}, credit score ${profile.creditScore}.
READINESS SCORES:
${scoreLines}

Return JSON of this exact shape:
{"steps":[{"title": string (max 80 chars), "description": string (one clear sentence), "actionLabel": string (short CTA, max 30 chars)}]}
Provide 4 to 6 steps ordered from most urgent to longer-term.`;

    const resp = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: system },
        { role: "user", content: ctx },
      ],
      response_format: { type: "json_object" },
    });
    const raw = resp.choices[0]?.message?.content ?? "{}";
    let stepsRaw: unknown[] = [];
    try {
      const parsedJson = JSON.parse(raw);
      if (Array.isArray(parsedJson?.steps)) stepsRaw = parsedJson.steps;
    } catch {
      stepsRaw = [];
    }

    const clean = stepsRaw
      .slice(0, 6)
      .map((s, i) => {
        const step = (s ?? {}) as Record<string, unknown>;
        return {
          title:
            (typeof step.title === "string" ? step.title.slice(0, 160) : "") ||
            `Step ${i + 1}`,
          description:
            typeof step.description === "string"
              ? step.description.slice(0, 500)
              : null,
          actionLabel:
            typeof step.actionLabel === "string"
              ? step.actionLabel.slice(0, 60)
              : null,
          status: "todo",
          orderIndex: i,
        };
      })
      .filter((s) => s.title);

    if (clean.length === 0) {
      res.status(500).json({ error: "Could not generate a roadmap right now" });
      return;
    }

    await db.delete(roadmapSteps);
    const inserted = await db.insert(roadmapSteps).values(clean).returning();
    res.json(inserted);
  } catch (err) {
    req.log.error({ err }, "Roadmap generation failed");
    res.status(500).json({ error: "Could not generate a roadmap right now" });
  }
});

export default router;
