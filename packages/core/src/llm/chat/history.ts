/**
 * 对话历史管理
 * 
 * 管理对话消息历史，支持有效消息过滤
 * Requirements: 8.1
 */

import type { UnifiedMessage, UnifiedContentPart } from '../types/index.js';
import { isValidMessage } from '../types/message.js';

/**
 * 对话历史管理器
 */
export class ChatHistory {
  private messages: UnifiedMessage[] = [];

  constructor(initialMessages?: UnifiedMessage[]) {
    if (initialMessages) {
      this.messages = [...initialMessages];
    }
  }

  /**
   * 添加消息
   */
  add(message: UnifiedMessage): void {
    this.messages.push(message);
  }

  /**
   * 添加多条消息
   */
  addAll(messages: UnifiedMessage[]): void {
    this.messages.push(...messages);
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * 获取所有消息
   */
  getAll(): UnifiedMessage[] {
    return [...this.messages];
  }

  /**
   * 获取有效消息 (过滤无效的 assistant 响应)
   */
  getCurated(): UnifiedMessage[] {
    return extractCuratedHistory(this.messages);
  }

  /**
   * 设置消息列表
   */
  setMessages(messages: UnifiedMessage[]): void {
    this.messages = [...messages];
  }

  /**
   * 获取最后一条消息
   */
  getLast(): UnifiedMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  /**
   * 获取消息数量
   */
  get length(): number {
    return this.messages.length;
  }

  /**
   * 移除最后 N 条消息
   */
  removeLast(count: number = 1): UnifiedMessage[] {
    return this.messages.splice(-count, count);
  }

  /**
   * 深拷贝历史
   */
  clone(): ChatHistory {
    return new ChatHistory(structuredClone(this.messages));
  }
}

/**
 * 提取有效历史
 * 
 * 模型有时会生成无效或空的内容（如安全过滤或引用问题）。
 * 提取有效轮次确保后续请求能被模型接受。
 */
export function extractCuratedHistory(history: UnifiedMessage[]): UnifiedMessage[] {
  if (!history || history.length === 0) {
    return [];
  }

  const curated: UnifiedMessage[] = [];
  let i = 0;

  while (i < history.length) {
    const message = history[i];

    if (message.role === 'user' || message.role === 'tool') {
      // 用户消息和工具结果直接保留
      curated.push(message);
      i++;
    } else if (message.role === 'assistant') {
      // 收集连续的 assistant 消息
      const assistantMessages: UnifiedMessage[] = [];
      let isValid = true;

      while (i < history.length && history[i].role === 'assistant') {
        assistantMessages.push(history[i]);
        if (isValid && !isValidMessage(history[i])) {
          isValid = false;
        }
        i++;
      }

      // 只有当所有连续的 assistant 消息都有效时才保留
      if (isValid) {
        curated.push(...assistantMessages);
      }
    } else {
      // system 消息跳过（通过 systemInstruction 处理）
      i++;
    }
  }

  return curated;
}

/**
 * 验证历史消息角色是否正确
 */
export function validateHistory(history: UnifiedMessage[]): void {
  for (const message of history) {
    if (!['user', 'assistant', 'system', 'tool'].includes(message.role)) {
      throw new Error(`Invalid role: ${message.role}`);
    }
  }
}

/**
 * 从历史中提取系统消息
 */
export function extractSystemMessage(history: UnifiedMessage[]): string | undefined {
  const systemMessage = history.find(m => m.role === 'system');
  if (!systemMessage) return undefined;

  return systemMessage.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n');
}
