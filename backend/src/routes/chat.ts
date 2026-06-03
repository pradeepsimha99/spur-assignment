import { Router, Request, Response } from 'express';
import { validateChatRequest } from '../middleware/validation';
import {
  getOrCreateConversation,
  saveUserMessage,
  saveAiMessage,
  getConversationHistory,
  listConversations,
} from '../services/conversation';
import { generateReply, generateReplyStream } from '../services/llm';
import { getIdempotencyResult, setIdempotencyResult } from '../services/idempotency';
import { ChatRequest, ChatResponse } from '../models/types';

const router = Router();

/**
 * POST /chat/message
 *
 * Accepts { message: string, sessionId?: string, idempotencyKey?: string }
 * Returns { reply: string, sessionId: string, idempotencyKey?: string }
 * Non-streaming JSON response.
 */
router.post('/message', validateChatRequest, async (req: Request, res: Response) => {
  const { message, sessionId, idempotencyKey } = req.body as ChatRequest;

  // Check idempotency first
  if (idempotencyKey) {
    const cached = await getIdempotencyResult(idempotencyKey);
    if (cached) {
      const response: ChatResponse = { ...cached, idempotencyKey };
      res.json(response);
      return;
    }
  }

  try {
    // Step 1: Get or create conversation
    const conversation = await getOrCreateConversation(sessionId);
    const convId = conversation.id;

    // Step 2: Save user message
    await saveUserMessage(convId, message);

    // Step 3: Get conversation history for context
    const history = await getConversationHistory(convId);

    // Step 4: Generate AI reply
    let reply: string;
    try {
      reply = await generateReply(history, message);
    } catch (llmError: any) {
      reply = `I'm sorry, but I encountered an error: ${llmError.message || 'Please try again later.'}`;
    }

    // Step 5: Save AI reply
    await saveAiMessage(convId, reply);

    // Step 6: Cache idempotency result if key was provided
    const result: ChatResponse = { reply, sessionId: convId };
    if (idempotencyKey) {
      await setIdempotencyResult(idempotencyKey, { reply, sessionId: convId });
      result.idempotencyKey = idempotencyKey;
    }

    // Step 7: Return response
    res.json(result);
  } catch (error: any) {
    console.error('[Chat] Error processing message:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process your message. Please try again.',
    });
  }
});

/**
 * POST /chat/message/stream
 *
 * Same as POST /chat/message but streams the response as Server-Sent Events (SSE).
 * Accepts { message: string, sessionId?: string, idempotencyKey?: string }
 *
 * SSE event types:
 *   data: {"type":"token","text":"<partial text>"}
 *   data: {"type":"done","sessionId":"<id>","reply":"<full text>"}
 *   data: {"type":"error","message":"<error message>"}
 */
router.post('/message/stream', validateChatRequest, async (req: Request, res: Response) => {
  const { message, sessionId, idempotencyKey } = req.body as ChatRequest;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Check idempotency for streaming — if cached, send the full response immediately via SSE
  if (idempotencyKey) {
    const cached = await getIdempotencyResult(idempotencyKey);
    if (cached) {
      res.write(`data: ${JSON.stringify({ type: 'token', text: cached.reply })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', sessionId: cached.sessionId, reply: cached.reply, idempotencyKey })}\n\n`);
      res.end();
      return;
    }
  }

  try {
    // Step 1: Get or create conversation
    const conversation = await getOrCreateConversation(sessionId);
    const convId = conversation.id;

    // Step 2: Save user message
    await saveUserMessage(convId, message);

    // Step 3: Get conversation history for context
    const history = await getConversationHistory(convId);

    // Step 4: Stream AI reply
    try {
      let accumulated = '';

      for await (const token of generateReplyStream(history, message)) {
        accumulated += token;
        res.write(`data: ${JSON.stringify({ type: 'token', text: token })}\n\n`);
      }

      const reply = accumulated || 'I apologize, but I was unable to generate a response. Please try again.';

      // Step 5: Save AI reply
      await saveAiMessage(convId, reply);

      // Step 6: Cache idempotency result if key was provided
      if (idempotencyKey) {
        await setIdempotencyResult(idempotencyKey, { reply, sessionId: convId });
      }

      // Step 7: Send done event
      const donePayload: any = { type: 'done', sessionId: convId, reply };
      if (idempotencyKey) donePayload.idempotencyKey = idempotencyKey;
      res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
      res.end();
    } catch (llmError: any) {
      const errorMessage = llmError.message || 'Please try again later.';
      const friendlyReply = `I'm sorry, but I encountered an error: ${errorMessage}`;

      // Save the error message so it shows in history on reload
      await saveAiMessage(convId, friendlyReply);

      res.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', sessionId: convId, reply: friendlyReply })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error('[Chat] Error processing message:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal server error. Please try again.' })}\n\n`);
    res.end();
  }
});

/**
 * GET /chat/conversations
 *
 * List all conversations ordered by most recent first.
 * Returns summary info: id, preview, timestamps, message count.
 *
 * IMPORTANT: This MUST be defined before /:sessionId/messages so Express
 * resolves /conversations as a literal path, not a sessionId param.
 */
router.get('/conversations', async (_req: Request, res: Response) => {
  try {
    const conversations = await listConversations();
    res.json({ conversations });
  } catch (error: any) {
    console.error('[Chat] Error listing conversations:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list conversations.',
    });
  }
});

/**
 * GET /chat/:sessionId/messages
 *
 * Fetch all messages for a given session/conversation.
 */
router.get('/:sessionId/messages', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'sessionId is required.',
    });
    return;
  }

  try {
    const conversation = await getOrCreateConversation(sessionId.trim());
    res.json({
      sessionId: conversation.id,
      messages: conversation.messages,
    });
  } catch (error: any) {
    console.error('[Chat] Error fetching messages:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch messages.',
    });
  }
});

export default router;
