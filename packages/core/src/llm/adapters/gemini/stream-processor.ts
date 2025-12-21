/**
 * Gemini 流处理器
 * 
 * 将 Gemini SDK 的流式响应转换为统一流式事件
 * Requirements: 5.3, 5.4
 */

import type { GenerateContentResponse, Part } from '@google/genai';
import type { UnifiedStreamEvent, UnifiedToolCall } from '../../types/index.js';
import { UnifiedFinishReason, mapGeminiFinishReason } from '../../types/stream.js';
import { extractTextFromGeminiParts, extractToolCallsFromGeminiParts } from './converter.js';

/**
 * 处理 Gemini 流式响应
 * 
 * @param stream Gemini SDK 的流式响应
 * @yields 统一流式事件
 */
export async function* processGeminiStream(
  stream: AsyncIterable<GenerateContentResponse>,
): AsyncGenerator<UnifiedStreamEvent> {
  for await (const response of stream) {
    const traceId = response.responseId;
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    
    // 1. 处理 thought (思考过程)
    const thoughtPart = parts.find(
      (p) => (p as Part & { thought?: boolean }).thought
    );
    if (thoughtPart?.text) {
      yield {
        type: 'thought',
        thought: thoughtPart.text,
      };
      continue;  // thought 响应不包含其他内容
    }
    
    // 2. 处理文本内容
    const text = extractTextFromGeminiParts(parts);
    if (text) {
      yield {
        type: 'contentDelta',
        delta: text,
        traceId,
      };
    }
    
    // 3. 处理工具调用
    const toolCalls = extractToolCallsFromGeminiParts(parts);
    for (const toolCall of toolCalls) {
      yield {
        type: 'toolCallDelta',
        toolCallId: toolCall.id,
        name: toolCall.name,
        argumentsDelta: JSON.stringify(toolCall.arguments),
      };
    }
    
    // 4. 处理使用量
    if (response.usageMetadata) {
      const usage = response.usageMetadata;
      yield {
        type: 'usage',
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
      };
    }
    
    // 5. 处理完成原因
    const finishReason = candidate?.finishReason;
    if (finishReason) {
      yield {
        type: 'done',
        finishReason: mapGeminiFinishReason(finishReason),
      };
    }
  }
}

/**
 * 从流中收集完整响应
 * 
 * @param stream 统一流式事件
 * @returns 收集的响应数据
 */
export async function collectStreamResponse(
  stream: AsyncIterable<UnifiedStreamEvent>,
): Promise<{
  text: string;
  toolCalls: UnifiedToolCall[];
  finishReason: UnifiedFinishReason;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  thoughts: string[];
}> {
  let text = '';
  const toolCalls: UnifiedToolCall[] = [];
  const toolCallMap = new Map<string, { name?: string; args: string }>();
  let finishReason = UnifiedFinishReason.Stop;
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
  const thoughts: string[] = [];
  
  for await (const event of stream) {
    switch (event.type) {
      case 'contentDelta':
        text += event.delta;
        break;
      
      case 'toolCallDelta': {
        const existing = toolCallMap.get(event.toolCallId);
        if (existing) {
          if (event.name) existing.name = event.name;
          if (event.argumentsDelta) existing.args += event.argumentsDelta;
        } else {
          toolCallMap.set(event.toolCallId, {
            name: event.name,
            args: event.argumentsDelta || '',
          });
        }
        break;
      }
      
      case 'usage':
        usage = {
          promptTokens: event.promptTokens,
          completionTokens: event.completionTokens,
          totalTokens: event.totalTokens,
        };
        break;
      
      case 'done':
        finishReason = event.finishReason;
        break;
      
      case 'thought':
        thoughts.push(event.thought);
        break;
    }
  }
  
  // 转换工具调用
  for (const [id, data] of toolCallMap) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(data.args);
    } catch {
      // 保持空对象
    }
    toolCalls.push({
      id,
      name: data.name || 'unknown',
      arguments: args,
    });
  }
  
  return { text, toolCalls, finishReason, usage, thoughts };
}
