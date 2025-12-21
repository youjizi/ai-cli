/**
 * 统一流式事件类型
 * 
 * 定义跨提供商的标准化流式响应格式
 * Requirements: 1.5, 1.6
 */

/**
 * 完成原因
 */
export enum UnifiedFinishReason {
  /** 正常完成 */
  Stop = 'stop',
  /** 达到最大 token 限制 */
  Length = 'length',
  /** 需要调用工具 */
  ToolCalls = 'toolCalls',
  /** 内容被安全过滤器拦截 */
  ContentFilter = 'contentFilter',
  /** 发生错误 */
  Error = 'error',
}

/**
 * 内容增量事件
 */
export interface UnifiedContentDeltaEvent {
  type: 'contentDelta';
  /** 增量文本 */
  delta: string;
  /** 追踪 ID (可选) */
  traceId?: string;
}

/**
 * 工具调用增量事件
 */
export interface UnifiedToolCallDeltaEvent {
  type: 'toolCallDelta';
  /** 工具调用 ID */
  toolCallId: string;
  /** 工具名称 (首次出现时) */
  name?: string;
  /** 参数增量 (JSON 字符串片段) */
  argumentsDelta?: string;
}

/**
 * 使用量事件
 */
export interface UnifiedUsageEvent {
  type: 'usage';
  /** 输入 token 数 */
  promptTokens: number;
  /** 输出 token 数 */
  completionTokens: number;
  /** 总 token 数 */
  totalTokens: number;
}

/**
 * 完成事件
 */
export interface UnifiedDoneEvent {
  type: 'done';
  /** 完成原因 */
  finishReason: UnifiedFinishReason;
}

/**
 * 思考过程事件 (部分模型支持)
 */
export interface UnifiedThoughtEvent {
  type: 'thought';
  /** 思考内容 */
  thought: string;
}

/**
 * 统一流式事件类型
 */
export type UnifiedStreamEvent =
  | UnifiedContentDeltaEvent
  | UnifiedToolCallDeltaEvent
  | UnifiedUsageEvent
  | UnifiedDoneEvent
  | UnifiedThoughtEvent;

// ==================== 辅助函数 ====================

/**
 * 检查事件是否为内容增量
 */
export function isContentDelta(event: UnifiedStreamEvent): event is UnifiedContentDeltaEvent {
  return event.type === 'contentDelta';
}

/**
 * 检查事件是否为工具调用增量
 */
export function isToolCallDelta(event: UnifiedStreamEvent): event is UnifiedToolCallDeltaEvent {
  return event.type === 'toolCallDelta';
}

/**
 * 检查事件是否为完成事件
 */
export function isDoneEvent(event: UnifiedStreamEvent): event is UnifiedDoneEvent {
  return event.type === 'done';
}

/**
 * 从流式事件中收集完整文本
 */
export async function collectStreamText(
  stream: AsyncIterable<UnifiedStreamEvent>,
): Promise<string> {
  let text = '';
  for await (const event of stream) {
    if (isContentDelta(event)) {
      text += event.delta;
    }
  }
  return text;
}

/**
 * 从 Gemini FinishReason 映射到统一类型
 */
export function mapGeminiFinishReason(reason: string): UnifiedFinishReason {
  switch (reason) {
    case 'STOP':
      return UnifiedFinishReason.Stop;
    case 'MAX_TOKENS':
      return UnifiedFinishReason.Length;
    case 'SAFETY':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
      return UnifiedFinishReason.ContentFilter;
    case 'MALFORMED_FUNCTION_CALL':
      return UnifiedFinishReason.Error;
    default:
      // 包含 TOOL_CALLS 等
      if (reason.includes('TOOL') || reason.includes('FUNCTION')) {
        return UnifiedFinishReason.ToolCalls;
      }
      return UnifiedFinishReason.Stop;
  }
}
