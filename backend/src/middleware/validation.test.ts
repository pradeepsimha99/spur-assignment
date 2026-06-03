import { describe, it, expect, vi } from 'vitest';
import { validateChatRequest, errorHandler } from './validation';
import type { Request, Response, NextFunction } from 'express';

function createReq(body: any): Partial<Request> {
  return { body } as Partial<Request>;
}

function createRes(): { res: Partial<Response>; json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json } as any, json, status };
}

describe('validateChatRequest', () => {
  it('should accept a valid message', () => {
    const req = createReq({ message: 'Hello' }) as Request;
    const { res } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.message).toBe('Hello');
  });

  it('should trim the message', () => {
    const req = createReq({ message: '  Hello  ' }) as Request;
    const { res } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.message).toBe('Hello');
  });

  it('should reject empty message', () => {
    const req = createReq({ message: '' }) as Request;
    const { res, status, json } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('empty') })
    );
  });

  it('should reject whitespace-only message', () => {
    const req = createReq({ message: '   ' }) as Request;
    const { res, status, json } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('empty') })
    );
  });

  it('should reject message that is too long', () => {
    const longMessage = 'A'.repeat(2500);
    const req = createReq({ message: longMessage }) as Request;
    const { res, status, json } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('too long') })
    );
  });

  it('should reject missing message field', () => {
    const req = createReq({}) as Request;
    const { res, status, json } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });

  it('should reject non-string message', () => {
    const req = createReq({ message: 123 }) as Request;
    const { res, status, json } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });

  it('should accept valid sessionId', () => {
    const req = createReq({ message: 'Hi', sessionId: 'abc-123' }) as Request;
    const { res } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.sessionId).toBe('abc-123');
  });

  it('should reject empty sessionId', () => {
    const req = createReq({ message: 'Hi', sessionId: '' }) as Request;
    const { res, status, json } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });

  it('should accept a message at maximum length', () => {
    const maxMessage = 'A'.repeat(2000);
    const req = createReq({ message: maxMessage }) as Request;
    const { res } = createRes();
    const next = vi.fn() as NextFunction;

    validateChatRequest(req, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('errorHandler', () => {
  it('should return 500 with error message', () => {
    const err = new Error('Something broke');
    const req = {} as Request;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as any;
    const next = vi.fn() as NextFunction;

    errorHandler(err, req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Internal server error' })
    );
  });
});
