/**
 * 轮次处理
 * 
 * 管理单轮对话交互，处理工具调用
 * Requirements: 8.2
 */

import type { UnifiedChat, SendMessageOptions } from './chat.js';
import type {
  UnifiedContentPart,
  UnifiedStreamEvent
} from '../types/index.js';
import { UnifiedFinishReason } from '../types/stream.js';

/**
 * 轮次事件类型
 */
export enum TurnEventType {
  /** 文本内容 */
  Content = 'content',
  /** 工具调用请求 */
  ToolCallRequest = 'tool_call_request',
  /** 思考过程 */
  Thought = 'thought',
  /** 轮次完成 */
  Finished = 'finished',
  /** 错误 */
  Error = 'error',
  /** 重试 */
  Retry = 'retry',
  /** 使用量 */
  Usage = 'usage',
}

/**
 * 工具调用请求信息
 */
export interface ToolCallRequestInfo {
  /** 调用 ID */
  callId: string;
  /** 工具名称 */
  name: string;
  /** 参数 */
  args: Record<string, unknown>;
  /** 提示 ID */
  promptId: string;
}

/**
 * 轮次完成信息
 */
export interface TurnFinishedInfo {
  /** 完成原因 */
  reason: UnifiedFinishReason;
  /** 使用量 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 轮次事件
 */
export type TurnEvent =
  | { type: TurnEventType.Content; value: string; traceId?: string }
  | { type: TurnEventType.ToolCallRequest; value: ToolCallRequestInfo }
  | { type: TurnEventType.Thought; value: string }
  | { type: TurnEventType.Finished; value: TurnFinishedInfo }
  | { type: TurnEventType.Error; value: { message: string; status?: number } }
  | { type: TurnEventType.Retry }
  | { type: TurnEventType.Usage; value: { promptTokens: number; completionTokens: number; totalTokens: number } };

/**
 * 统一轮次处理器
 */
export class UnifiedTurn {
  /** 待处理的工具调用 */
  readonly pendingToolCalls: ToolCallRequestInfo[] = [];
  
  /** 完成原因 */
  finishReason: UnifiedFinishReason | undefined = undefined;

  constructor(
    private readonly chat: UnifiedChat,
    private readonly promptId: string,
  ) {}

  /**
   * 运行轮次
   */
  async *run(
    model: string,
    message: UnifiedContentPart[],
    signal: AbortSignal,
    options?: SendMessageOptions,
  ): AsyncGenerator<TurnEvent> {
    try {
      const stream = this.chat.sendMessageStream(
        model,
        message,
        this.promptId,
        signal,
        options,
      );

      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

      for await (const event of stream) {
        if (signal.aborted) {
          return;
        }

        yield* this.processStreamEvent(event);

        // 收集使用量
        if (event.type === 'usage') {
          usage = {
            promptTokens: event.promptTokens,
            completionTokens: event.completionTokens,
            totalTokens: event.totalTokens,
          };
        }

        // 记录完成原因
        if (event.type === 'done') {
          this.finishReason = event.finishReason;
        }
      }

      // 发送完成事件
      yield {
        type: TurnEventType.Finished,
        value: {
          reason: this.finishReason ?? UnifiedFinishReason.Stop,
          usage,
        },
      };
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      const status = this.extractStatus(error);

      yield {
        type: TurnEventType.Error,
        value: { message, status },
      };
    }
  }

  /**
   * 处理流式事件
   */
  private *processStreamEvent(event: UnifiedStreamEvent): Generator<TurnEvent> {
    switch (event.type) {
      case 'contentDelta':
        yield {
          type: TurnEventType.Content,
          value: event.delta,
          traceId: event.traceId,
        };
        break;

      case 'toolCallDelta':
        // 收集工具调用信息
        this.handleToolCallDelta(event);
        break;

      case 'thought':
        yield {
          type: TurnEventType.Thought,
          value: event.thought,
        };
        break;

      case 'usage':
        yield {
          type: TurnEventType.Usage,
          value: {
            promptTokens: event.promptTokens,
            completionTokens: event.completionTokens,
            totalTokens: event.totalTokens,
          },
        };
        break;

      case 'done':
        // 在完成时发送所有收集的工具调用请求
        for (const toolCall of this.pendingToolCalls) {
          yield {
            type: TurnEventType.ToolCallRequest,
            value: toolCall,
          };
        }
        break;
    }
  }

  /**
   * 处理工具调用增量
   */
  private handleToolCallDelta(event: {
    toolCallId: string;
    name?: string;
    argumentsDelta?: string;
  }): void {
    // 查找或创建工具调用
    let toolCall = this.pendingToolCalls.find(tc => tc.callId === event.toolCallId);
    
    if (!toolCall) {
      toolCall = {
        callId: event.toolCallId,
        name: event.name || 'unknown',
        args: {},
        promptId: this.promptId,
      };
      this.pendingToolCalls.push(toolCall);
    }

    // 更新名称
    if (event.name) {
      toolCall.name = event.name;
    }

    // 解析参数
    if (event.argumentsDelta) {
      try {
        toolCall.args = JSON.parse(event.argumentsDelta);
      } catch {
        // 参数可能是增量的，暂时忽略解析错误
      }
    }
  }

  /**
   * 从错误中提取状态码
   */
  private extractStatus(error: unknown): number | undefined {
    if (error && typeof error === 'object') {
      if ('status' in error && typeof error.status === 'number') {
        return error.status;
      }
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        return error.statusCode;
      }
    }
    return undefined;
  }
}

/**
 * 创建轮次处理器
 */
export function createTurn(chat: UnifiedChat, promptId: string): UnifiedTurn {
  return new UnifiedTurn(chat, promptId);
}
