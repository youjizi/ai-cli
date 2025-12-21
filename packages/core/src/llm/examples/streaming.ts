/**
 * 流式对话示例
 * 
 * 演示如何使用 LLM 抽象层进行流式对话
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

  // 创建适配器和对话
  const client = new GoogleGenAI({ apiKey });
  const adapter = new GeminiAdapter(client);
  const chat = new UnifiedChat(adapter, {
    systemInstruction: '你是一个友好的助手。',
  });

  const controller = new AbortController();
  
  console.log('User: 写一首关于编程的短诗。\n');
  console.log('Assistant: ');

  // 流式发送消息
  const stream = chat.sendMessageStream(
    'gemini-2.5-flash',
    [{ type: 'text', text: '写一首关于编程的短诗。' }],
    'prompt-1',
    controller.signal,
  );

  // 处理流式事件
  for await (const event of stream) {
    switch (event.type) {
      case 'contentDelta':
        process.stdout.write(event.delta);
        break;
      case 'thought':
        console.log(`\n[Thought: ${event.thought.substring(0, 50)}...]`);
        break;
      case 'done':
        console.log(`\n\n[Done: ${event.finishReason}]`);
        break;
      case 'usage':
        console.log(`[Tokens: ${event.promptTokens} + ${event.completionTokens} = ${event.totalTokens}]`);
        break;
    }
  }
}

main().catch(console.error);
