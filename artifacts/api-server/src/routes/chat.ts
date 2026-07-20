import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { chatSessionsTable, messagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateChatSessionBody, SendMessageBody } from "@workspace/api-zod";
import { trainingEngine } from "../lib/training/engine.js";

const router: IRouter = Router();

// GET /chat/sessions
router.get("/chat/sessions", async (req, res): Promise<void> => {
  try {
    const sessions = await db.select().from(chatSessionsTable).orderBy(desc(chatSessionsTable.updatedAt));
    const withCounts = await Promise.all(sessions.map(async (s) => {
      const msgs = await db.select().from(messagesTable).where(eq(messagesTable.sessionId, s.id));
      return {
        id: s.id,
        title: s.title,
        messageCount: msgs.length,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    }));
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: "Failed to load chat sessions" });
  }
});

// POST /chat/sessions
router.post("/chat/sessions", async (req, res): Promise<void> => {
  try {
    const parsed = CreateChatSessionBody.safeParse(req.body);
    const title = parsed.success && parsed.data.title ? parsed.data.title : "New Chat";
    const [session] = await db.insert(chatSessionsTable).values({ title }).returning();
    res.status(201).json({
      id: session.id,
      title: session.title,
      messageCount: 0,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create chat session" });
  }
});

// DELETE /chat/sessions/:sessionId
router.delete("/chat/sessions/:sessionId", async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const sessionId = parseInt(raw, 10);
    if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid sessionId" }); return; }
    await db.delete(messagesTable).where(eq(messagesTable.sessionId, sessionId));
    await db.delete(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chat session" });
  }
});

// GET /chat/sessions/:sessionId/messages
router.get("/chat/sessions/:sessionId/messages", async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const sessionId = parseInt(raw, 10);
    if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid sessionId" }); return; }
    const messages = await db.select().from(messagesTable)
      .where(eq(messagesTable.sessionId, sessionId))
      .orderBy(messagesTable.createdAt);
    res.json(messages.map(m => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      thinkingMode: m.thinkingMode,
      createdAt: m.createdAt.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /chat/sessions/:sessionId/messages
router.post("/chat/sessions/:sessionId/messages", async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const sessionId = parseInt(raw, 10);
    if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid sessionId" }); return; }

    const parsed = SendMessageBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const { content, thinkingMode = false } = parsed.data;

    // Save user message
    await db.insert(messagesTable).values({ sessionId, role: "user", content, thinkingMode });

    // Auto-update session title if first message
    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.sessionId, sessionId));
    if (msgs.length === 1) {
      const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
      await db.update(chatSessionsTable).set({ title }).where(eq(chatSessionsTable.id, sessionId));
    }

    // Generate AI response from trained model
    const responseText = trainingEngine.generateResponse(content);

    // Save assistant message
    const [msg] = await db.insert(messagesTable).values({
      sessionId,
      role: "assistant",
      content: responseText,
      thinkingMode,
    }).returning();

    res.json({
      id: msg.id,
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      thinkingMode: msg.thinkingMode,
      createdAt: msg.createdAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
