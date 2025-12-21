/**
 * 统一对话管理
 * 
 * 提供跨提供商的对话管理功能
 * Requirements: 8.1
 */

import type {
  LLMProviderAdapter,
  UnifiedGenerateRequest,
  UnifiedGenerateResponse,
} from '../adapter/interface.js';
import type {
  UnifiedMessage,
  UnifiedContentPart,
  UnifiedStreamEvent,
  UnifiedToolSchema,
  UnifiedToolChoice,
} from '../types/index.js';
import { ChatHistory, validateHistory } from './history.js';

/**
 * 对话配置选项
 */
export interface ChatOptions {
  /** 系统指令 */
  systemInstruction?: string;
  /** 初始历史 */
  history?: UnifiedMessage[];
  /** 可用工具 */
  tools?: UnifiedToolSchema[];
  /** 工具选择模式 */
  toolChoice?: UnifiedToolChoice;
  /** 默认温度 */
  temperature?: number;
  /** 默认最大输出 token */
  maxTokens?: number;
}

/**
 * 发送消息选项
 */
export interface SendMessageOptions {
  /** 温度 (覆盖默认值) */
  temperature?: number;
  /** 最大输出 token (覆盖默认值) */
  maxTokens?: number;
  /** 工具选择模式 (覆盖默认值) */
  toolChoice?: UnifiedToolChoice;
  /** 响应格式 */
  responseFormat?: 'text' | 'json';
  /** JSON 响应 schema */
  responseSchema?: Record<string, unknown>;
}

/**
 * 统一对话类
 */
export class UnifiedChat {
  private history: ChatHistory;
  private systemInstruction: string;
  private tools: UnifiedToolSchema[];
  private toolChoice: UnifiedToolChoice;
  private defaultTemperature?: number;
  private defaultMaxTokens?: number;

  constructor(
    private readonly adapter: LLMProviderAdapter,
    options: ChatOptions = {},
  ) {
    this.history = new ChatHistory(options.history);
    this.systemInstruction = options.systemInstruction || '';
    this.tools = options.tools || [];
    this.toolChoice = options.toolChoice || 'auto';
    this.defaultTemperature = options.temperature;
    this.defaultMaxTokens = options.maxTokens;

    if (options.history) {
      validateHistory(options.history);
    }
  }

  /**
   * 设置系统指令
   */
  setSystemInstruction(instruction: string): void {
    this.systemInstruction = instruction;
  }

  /**
   * 获取系统指令
   */
  getSystemInstruction(): string {
    return this.systemInstruction;
  }

  /**
   * 设置工具
   */
  setTools(tools: UnifiedToolSchema[]): void {
    this.tools = tools;
  }

  /**
   * 获取工具
   */
  getTools(): UnifiedToolSchema[] {
    return this.tools;
  }

  /**
   * 发送消息 (非流式)
   */
  async sendMessage(
    model: string,
    message: UnifiedContentPart[],
    promptId: string,
    signal: AbortSignal,
    options: SendMessageOptions = {},
  ): Promise<UnifiedGenerateResponse> {
    // 创建用户消息并加入历史
    const userMessage: UnifiedMessage = {
      role: 'user',
      content: message,
    };
    this.history.add(userMessage);

    // 构建请求
    const request = this.buildRequest(model, signal, options);

    try {
      // 调用适配器
      const response = await this.adapter.generateContent(request, promptId);

      // 将响应加入历史
      this.history.add(response.message);

      return response;
    } catch (error) {
      // 发生错误时移除刚添加的用户消息
      this.history.removeLast();
      throw error;
    }
  }

  /**
   * 发送消息 (流式)
   */
  async *sendMessageStream(
    model: string,
    message: UnifiedContentPart[],
    promptId: string,
    signal: AbortSignal,
    options: SendMessageOptions = {},
  ): AsyncGenerator<UnifiedStreamEvent> {
    // 创建用户消息并加入历史
    const userMessage: UnifiedMessage = {
      role: 'user',
      content: message,
    };
    this.history.add(userMessage);

    // 构建请求
    const request = this.buildRequest(model, signal, options);

    // 收集响应内容
    const responseContent: UnifiedContentPart[] = [];
    let currentText = '';
    const toolCalls = new Map<string, { name?: string; args: string }>();

    try {
      // 调用适配器流式接口
      const stream = this.adapter.generateContentStream(request, promptId);

      for await (const event of stream) {
        // 收集内容
        if (event.type === 'contentDelta') {
          currentText += event.delta;
        } else if (event.type === 'toolCallDelta') {
          const existing = toolCalls.get(event.toolCallId);
          if (existing) {
            if (event.name) existing.name = event.name;
            if (event.argumentsDelta) existing.args += event.argumentsDelta;
          } else {
            toolCalls.set(event.toolCallId, {
              name: event.name,
              args: event.argumentsDelta || '',
            });
          }
        }

        yield event;
      }

      // 构建响应消息
      if (currentText) {
        responseContent.push({ type: 'text', text: currentText });
      }
      for (const [id, data] of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(data.args);
        } catch {
          // 保持空对象
        }
        responseContent.push({
          type: 'toolCall',
          toolCall: {
            id,
            name: data.name || 'unknown',
            arguments: args,
          },
        });
      }

      // 将响应加入历史
      if (responseContent.length > 0) {
        this.history.add({
          role: 'assistant',
          content: responseContent,
        });
      }
    } catch (error) {
      // 发生错误时移除刚添加的用户消息
      this.history.removeLast();
      throw error;
    }
  }

  /**
   * 添加工具结果到历史
   */
  addToolResult(
    toolCallId: string,
    result: UnifiedContentPart[],
    isError: boolean = false,
  ): void {
    this.history.add({
      role: 'tool',
      content: [{
        type: 'toolResult',
        toolResult: {
          toolCallId,
          content: result,
          isError,
        },
      }],
    });
  }

  /**
   * 获取历史
   */
  getHistory(curated: boolean = false): UnifiedMessage[] {
    return curated ? this.history.getCurated() : this.history.getAll();
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.history.clear();
  }

  /**
   * 设置历史
   */
  setHistory(messages: UnifiedMessage[]): void {
    validateHistory(messages);
    this.history.setMessages(messages);
  }

  /**
   * 获取适配器
   */
  getAdapter(): LLMProviderAdapter {
    return this.adapter;
  }

  // ==================== 私有方法 ====================

  /**
   * 构建请求
   */
  private buildRequest(
    model: string,
    signal: AbortSignal,
    options: SendMessageOptions,
  ): UnifiedGenerateRequest {
    return {
      model,
      messages: this.history.getCurated(),
      systemInstruction: this.systemInstruction || undefined,
      tools: this.tools.length > 0 ? this.tools : undefined,
      toolChoice: options.toolChoice ?? this.toolChoice,
      temperature: options.temperature ?? this.defaultTemperature,
      maxTokens: options.maxTokens ?? this.defaultMaxTokens,
      responseFormat: options.responseFormat,
      responseSchema: options.responseSchema,
      abortSignal: signal,
    };
  }
}

/**
 * 创建对话实例
 */
export function createChat(
  adapter: LLMProviderAdapter,
  options?: ChatOptions,
): UnifiedChat {
  return new UnifiedChat(adapter, options);
}
