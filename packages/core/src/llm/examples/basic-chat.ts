/**
 * 基础对话示例
 * 
 * 演示如何使用 LLM 抽象层进行简单对话
 */

import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { GeminiAdapter } from '../adapters/gemini/index.js';
import { UnifiedChat } from '../chat/chat.js';

// 加载环境变量
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY not found');
    process.exit(1);
  }

  // 1. 创建 Google GenAI 客户端
  const client = new GoogleGenAI({ apiKey });

  // 2. 创建 Gemini 适配器
  const adapter = new GeminiAdapter(client);

  // 3. 创建对话实例
  const chat = new UnifiedChat(adapter, {
    systemInstruction: '你是一个友好的助手，回答要简洁。',
  });

  // 4. 发送消息
  const controller = new AbortController();
  
  console.log('User: 你好，请用一句话介绍你自己。');
  
  const response = await chat.sendMessage(
    'gemini-2.0-flash',
    [{ type: 'text', text: '你好，请用一句话介绍你自己。' }],
    'prompt-1',
    controller.signal,
  );

  // 5. 输出响应
  const text = response.message.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');

  console.log(`Assistant: ${text}`);
  console.log(`\nFinish Reason: ${response.finishReason}`);
  if (response.usage) {
    console.log(`Tokens: ${response.usage.promptTokens} prompt, ${response.usage.completionTokens} completion`);
  }
}

main().catch(console.error);
