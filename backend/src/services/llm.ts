import OpenAI from 'openai';
import { LLMConfig } from '../models/types';
import { cacheGet, cacheSet } from '../cache/redis';

const STORE_FAQ = `
You are a helpful support agent for "SpurStore" — a small e-commerce store that sells handmade goods, digital products, and curated gift boxes.

## Store Policies

### Shipping Policy
- Free standard shipping on orders over $50 (5-8 business days)
- Express shipping available for $12.99 (2-3 business days)
- International shipping to most countries for $19.99 (10-14 business days)
- Tracking is provided via email once the order ships

### Return & Refund Policy
- 30-day return window from delivery date
- Items must be unused and in original packaging
- Refunds processed within 5-7 business days after we receive the item
- Digital products are non-refundable unless the product is defective
- Free return shipping on defective items; buyer pays return shipping otherwise

### Support Hours
- Monday - Friday: 9:00 AM - 8:00 PM EST
- Saturday: 10:00 AM - 4:00 PM EST
- Sunday: Closed
- Response time is typically under 2 hours during business hours

### Contact Information
- Email: support@spurstore.com
- Phone: +1 (800) 555-0199
- Live chat available during business hours

## Guidelines
- Answer clearly and concisely.
- Be friendly and professional, like a real support agent.
- If you don't know the answer, offer to connect the user with a human agent.
- Keep responses to 2-3 paragraphs maximum.
- Always ask if there's anything else you can help with.
`;

export function getLLMConfig(): LLMConfig {
  return {
    apiKey: process.env.GROQ_API_KEY || '',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    maxTokens: Number(process.env.LLM_MAX_TOKENS) || 500,
    maxMessages: Number(process.env.LLM_MAX_MESSAGES) || 20,
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.7,
  };
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Build the messages array for the LLM call from conversation history.
 */
function buildMessages(history: { sender: string; text: string }[]): Message[] {
  const config = getLLMConfig();
  const messages: Message[] = [
    { role: 'system', content: STORE_FAQ },
  ];

  const maxHistoryMessages = Math.min(config.maxMessages, 20);
  const recentHistory = history.slice(-maxHistoryMessages);

  for (const msg of recentHistory) {
    if (msg.sender === 'user') {
      messages.push({ role: 'user', content: msg.text });
    } else {
      messages.push({ role: 'assistant', content: msg.text });
    }
  }

  return messages;
}

/**
 * Get the OpenAI client instance.
 */
function getOpenAI(): OpenAI {
  const config = getLLMConfig();
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
}

/**
 * Cache an FAQ response if the question is simple enough.
 */
async function cacheFAQResponse(userMessage: string, reply: string): Promise<void> {
  const cacheKey = `faq:${userMessage.toLowerCase().trim().slice(0, 100)}`;
  if (userMessage.split(' ').length <= 15) {
    await cacheSet(cacheKey, reply, 3600);
  }
}

/**
 * Check for a cached FAQ response.
 */
async function getCachedFAQ(userMessage: string): Promise<string | null> {
  const cacheKey = `faq:${userMessage.toLowerCase().trim().slice(0, 100)}`;
  return cacheGet(cacheKey);
}

/**
 * Handle LLM API errors and throw user-friendly messages.
 */
function handleLLMError(error: any): never {
  console.error('[LLM] API call failed:', error.message);

  if (error.status === 401) {
    throw new Error('Invalid API key. Please check your GROQ_API_KEY.');
  }
  if (error.status === 429) {
    throw new Error('Rate limit exceeded. Please try again in a moment.');
  }
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    throw new Error('The AI service is taking too long to respond. Please try again.');
  }

  throw new Error('Failed to get a response from the AI. Please try again later.');
}

/**
 * Generates a reply from the LLM given conversation history and the latest user message.
 * The history should be an array of { sender, text } objects from the database.
 */
export async function generateReply(
  history: { sender: string; text: string }[],
  userMessage: string
): Promise<string> {
  const config = getLLMConfig();

  if (!config.apiKey) {
    throw new Error('LLM API key is not configured. Please set GROQ_API_KEY in your .env file.');
  }

  // Check cache for FAQ-like questions
  const cachedReply = await getCachedFAQ(userMessage);
  if (cachedReply) {
    return cachedReply;
  }

  const openai = getOpenAI();
  const messages = buildMessages(history);

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    const reply = response.choices[0]?.message?.content?.trim() || 'I apologize, but I was unable to generate a response. Please try again.';

    // Cache FAQ-like responses
    await cacheFAQResponse(userMessage, reply);

    return reply;
  } catch (error: any) {
    handleLLMError(error);
  }
}

/**
 * Generates a streaming reply from the LLM.
 * Yields tokens as they arrive from the API.
 * The final value yielded is the full accumulated reply.
 */
export async function* generateReplyStream(
  history: { sender: string; text: string }[],
  userMessage: string
): AsyncGenerator<string, string, void> {
  const config = getLLMConfig();

  if (!config.apiKey) {
    throw new Error('LLM API key is not configured. Please set GROQ_API_KEY in your .env file.');
  }

  // Check cache for FAQ-like questions
  const cachedReply = await getCachedFAQ(userMessage);
  if (cachedReply) {
    yield cachedReply;
    return cachedReply;
  }

  const openai = getOpenAI();
  const messages = buildMessages(history);

  try {
    const stream = await openai.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: true,
    });

    let fullReply = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullReply += content;
        yield content;
      }
    }

    const trimmedReply = fullReply.trim() || 'I apologize, but I was unable to generate a response. Please try again.';

    // Cache FAQ-like responses
    await cacheFAQResponse(userMessage, trimmedReply);

    return trimmedReply;
  } catch (error: any) {
    handleLLMError(error);
  }
}
