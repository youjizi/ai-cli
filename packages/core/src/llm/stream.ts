import type { FinishReason, Usage } from './types.js';

/**
 * 文本增量事件
 *
 * 流式响应中，文本是一块一块返回的
 */
export interface TextDeltaEvent {
    type: 'text_delta';
    text: string;
}

/**
 * 工具调用事件
 *
 * 注意：这是完整的工具调用，不是增量！
 * 原因：工具调用需要完整信息才能执行
 */
export interface ToolCallEvent {
    type: 'tool_call';
    id: string;
    name: string;
    arguments: string;  // JSON 字符串
}

/**
 * 完成事件
 *
 * 流的最后一个事件，包含完成原因和使用量
 */
export interface DoneEvent {
    type: 'done';
    finishReason: FinishReason;
    usage?: Usage;
}

/**
 * 流式事件联合类型
 */
export type StreamEvent = TextDeltaEvent | ToolCallEvent | DoneEvent;