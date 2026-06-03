import { Request, Response, NextFunction } from 'express';

const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 1;

/**
 * Validates the chat message request body.
 */
export function validateChatRequest(req: Request, res: Response, next: NextFunction): void {
  const { message, sessionId, idempotencyKey } = req.body;

  // Check message exists and is a string
  if (message === undefined || message === null || typeof message !== 'string') {
    res.status(400).json({
      error: 'Invalid request',
      message: 'message is required and must be a string.',
    });
    return;
  }

  const trimmedMessage = message.trim();

  // Check empty message
  if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'message cannot be empty.',
    });
    return;
  }

  // Check message length
  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      error: 'Invalid request',
      message: `message is too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters. Your message was ${trimmedMessage.length} characters.`,
    });
    return;
  }

  // Validate sessionId if provided
  if (sessionId !== undefined && sessionId !== null) {
    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'sessionId must be a non-empty string if provided.',
      });
      return;
    }
    req.body.sessionId = sessionId.trim();
  }

  // Validate idempotencyKey if provided
  if (idempotencyKey !== undefined && idempotencyKey !== null) {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'idempotencyKey must be a non-empty string if provided.',
      });
      return;
    }
    req.body.idempotencyKey = idempotencyKey.trim();
  }

  // Overwrite with trimmed message
  req.body.message = trimmedMessage;
  next();
}

/**
 * Global error handler middleware.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Server] Unhandled error:', err.message);

  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong. Please try again later.',
  });
}
