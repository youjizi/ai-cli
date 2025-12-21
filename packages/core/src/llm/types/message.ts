/**
 * 统一消息类型
 * 
 * 定义跨提供商的标准化消息格式
 * Requirements: 1.1, 1.2
 */

/**
 * 统一角色类型
 */
export type UnifiedRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * 文本内容部分
 */
export interface UnifiedTextPart {
  type: 'text';
  text: string;
}

/**
 * 图片内容部分
 */
export interface UnifiedImagePart {
  type: 'image';
  mimeType: string;
  /** Base64 编码的图片数据 */
  data?: string;
  /** 图片 URL */
  url?: string;
}

/**
 * 音频内容部分
 */
export interface UnifiedAudioPart {
  type: 'audio';
  mimeType: string;
  /** Base64 编码的音频数据 */
  data: string;
}

/**
 * 文件内容部分
 */
export interface UnifiedFilePart {
  type: 'file';
  mimeType: string;
  /** Base64 编码的文件数据 */
  data: string;
  /** 文件名 */
  filename?: string;
}

/**
 * 工具调用内容部分
 */
export interface UnifiedToolCallPart {
  type: 'toolCall';
  toolCall: UnifiedToolCall;
}

/**
 * 工具结果内容部分
 */
export interface UnifiedToolResultPart {
  type: 'toolResult';
  toolResult: UnifiedToolResult;
}

/**
 * 工具调用
 */
export interface UnifiedToolCall {
  /** 工具调用唯一标识 */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  arguments: Record<string, unknown>;
}

/**
 * 工具结果
 */
export interface UnifiedToolResult {
  /** 对应的工具调用 ID */
  toolCallId: string;
  /** 结果内容 */
  content: UnifiedContentPart[];
  /** 是否为错误结果 */
  isError: boolean;
}

/**
 * 统一内容部分类型
 */
export type UnifiedContentPart =
  | UnifiedTextPart
  | UnifiedImagePart
  | UnifiedAudioPart
  | UnifiedFilePart
  | UnifiedToolCallPart
  | UnifiedToolResultPart;

/**
 * 统一消息
 */
export interface UnifiedMessage {
  /** 消息角色 */
  role: UnifiedRole;
  /** 消息内容 */
  content: UnifiedContentPart[];
  /** 元数据 (用于传递提供商特有信息) */
  metadata?: Record<string, unknown>;
}

// ==================== 辅助函数 ====================

/**
 * 创建文本消息
 */
export function createTextMessage(role: UnifiedRole, text: string): UnifiedMessage {
  return {
    role,
    content: [{ type: 'text', text }],
  };
}

/**
 * 创建用户消息
 */
export function createUserMessage(text: string): UnifiedMessage {
  return createTextMessage('user', text);
}

/**
 * 创建助手消息
 */
export function createAssistantMessage(text: string): UnifiedMessage {
  return createTextMessage('assistant', text);
}

/**
 * 从消息中提取文本内容
 */
export function extractText(message: UnifiedMessage): string {
  return message.content
    .filter((part): part is UnifiedTextPart => part.type === 'text')
    .map(part => part.text)
    .join('');
}

/**
 * 从消息中提取工具调用
 */
export function extractToolCalls(message: UnifiedMessage): UnifiedToolCall[] {
  return message.content
    .filter((part): part is UnifiedToolCallPart => part.type === 'toolCall')
    .map(part => part.toolCall);
}

/**
 * 检查消息是否包含工具调用
 */
export function hasToolCalls(message: UnifiedMessage): boolean {
  return message.content.some(part => part.type === 'toolCall');
}

/**
 * 检查消息内容是否有效
 */
export function isValidMessage(message: UnifiedMessage): boolean {
  return message.content.length > 0 && message.content.some(part => {
    switch (part.type) {
      case 'text':
        return part.text.length > 0;
      case 'image':
        return !!(part.data || part.url);
      case 'audio':
      case 'file':
        return !!part.data;
      case 'toolCall':
        return !!part.toolCall.id && !!part.toolCall.name;
      case 'toolResult':
        return !!part.toolResult.toolCallId;
      default:
        return false;
    }
  });
}
