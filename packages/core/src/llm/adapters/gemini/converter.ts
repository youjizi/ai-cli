/**
 * Gemini 类型转换器
 * 
 * 在统一类型和 Gemini SDK 类型之间进行转换
 * Requirements: 5.2
 */

import type { Content, Part, FunctionCall, FunctionResponse } from '@google/genai';
import type {
  UnifiedMessage,
  UnifiedContentPart,
  UnifiedRole,
  UnifiedToolCall,
  UnifiedToolResult,
  UnifiedToolSchema,
} from '../../types/index.js';

// ==================== Role 映射 ====================

/**
 * 统一角色到 Gemini 角色的映射
 * 
 * 注意：Gemini 使用 'model' 而不是 'assistant'
 * 'system' 角色通过 systemInstruction 处理，不在消息中
 * 'tool' 角色的消息作为 user 消息发送，包含 functionResponse
 */
export function toGeminiRole(role: UnifiedRole): 'user' | 'model' {
  switch (role) {
    case 'user':
    case 'tool':  // tool 结果作为 user 消息发送
      return 'user';
    case 'assistant':
      return 'model';
    case 'system':
      // system 消息不应该出现在 contents 中
      throw new Error('System messages should be passed via systemInstruction');
    default:
      return 'user';
  }
}

/**
 * Gemini 角色到统一角色的映射
 */
export function fromGeminiRole(role: string): UnifiedRole {
  switch (role) {
    case 'model':
      return 'assistant';
    case 'user':
      return 'user';
    default:
      return 'user';
  }
}

// ==================== Part 转换 ====================

/**
 * 统一内容部分转换为 Gemini Part
 */
export function toGeminiPart(part: UnifiedContentPart): Part {
  switch (part.type) {
    case 'text':
      return { text: part.text };
    
    case 'image':
      if (part.data) {
        return {
          inlineData: {
            mimeType: part.mimeType,
            data: part.data,
          },
        };
      }
      if (part.url) {
        return {
          fileData: {
            mimeType: part.mimeType,
            fileUri: part.url,
          },
        };
      }
      throw new Error('Image part must have either data or url');
    
    case 'audio':
      return {
        inlineData: {
          mimeType: part.mimeType,
          data: part.data,
        },
      };
    
    case 'file':
      return {
        inlineData: {
          mimeType: part.mimeType,
          data: part.data,
        },
      };
    
    case 'toolCall':
      return {
        functionCall: {
          name: part.toolCall.name,
          args: part.toolCall.arguments,
        } as FunctionCall,
      };
    
    case 'toolResult':
      return {
        functionResponse: {
          name: part.toolResult.toolCallId,
          response: toGeminiFunctionResponse(part.toolResult),
        } as FunctionResponse,
      };
    
    default:
      throw new Error(`Unknown part type: ${(part as UnifiedContentPart).type}`);
  }
}

/**
 * Gemini Part 转换为统一内容部分
 */
export function fromGeminiPart(part: Part): UnifiedContentPart | null {
  // 文本
  if (part.text !== undefined) {
    // 跳过 thought 部分，通过 metadata 传递
    if ((part as Part & { thought?: boolean }).thought) {
      return null;
    }
    return { type: 'text', text: part.text };
  }
  
  // 内联数据 (图片/音频/文件)
  if (part.inlineData) {
    const mimeType = part.inlineData.mimeType || 'application/octet-stream';
    if (mimeType.startsWith('image/')) {
      return {
        type: 'image',
        mimeType,
        data: part.inlineData.data,
      };
    }
    if (mimeType.startsWith('audio/')) {
      return {
        type: 'audio',
        mimeType,
        data: part.inlineData.data || '',
      };
    }
    return {
      type: 'file',
      mimeType,
      data: part.inlineData.data || '',
    };
  }
  
  // 文件数据 (URL)
  if (part.fileData) {
    return {
      type: 'image',
      mimeType: part.fileData.mimeType || 'application/octet-stream',
      url: part.fileData.fileUri,
    };
  }
  
  // 函数调用
  if (part.functionCall) {
    const fnCall = part.functionCall;
    return {
      type: 'toolCall',
      toolCall: {
        id: (fnCall as FunctionCall & { id?: string }).id || 
            `${fnCall.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: fnCall.name || 'unknown',
        arguments: (fnCall.args || {}) as Record<string, unknown>,
      },
    };
  }
  
  // 函数响应
  if (part.functionResponse) {
    const fnResp = part.functionResponse;
    return {
      type: 'toolResult',
      toolResult: {
        toolCallId: fnResp.name || 'unknown',
        content: [{ type: 'text', text: JSON.stringify(fnResp.response) }],
        isError: false,
      },
    };
  }
  
  return null;
}

// ==================== Message 转换 ====================

/**
 * 统一消息转换为 Gemini Content
 */
export function toGeminiContent(message: UnifiedMessage): Content {
  const parts = message.content
    .map(toGeminiPart)
    .filter((p): p is Part => p !== null);
  
  return {
    role: toGeminiRole(message.role),
    parts,
  };
}

/**
 * Gemini Content 转换为统一消息
 */
export function fromGeminiContent(content: Content): UnifiedMessage {
  const parts = (content.parts || [])
    .map(fromGeminiPart)
    .filter((p): p is UnifiedContentPart => p !== null);
  
  // 提取 thought 信息到 metadata
  const metadata: Record<string, unknown> = {};
  const thoughtPart = content.parts?.find(
    (p) => (p as Part & { thought?: boolean }).thought
  );
  if (thoughtPart?.text) {
    metadata['thought'] = thoughtPart.text;
  }
  
  // 提取 thoughtSignature
  const partWithSignature = content.parts?.find(
    (p) => (p as Part & { thoughtSignature?: string }).thoughtSignature
  );
  if (partWithSignature) {
    metadata['thoughtSignature'] = (partWithSignature as Part & { thoughtSignature?: string }).thoughtSignature;
  }
  
  return {
    role: fromGeminiRole(content.role || 'user'),
    content: parts,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

/**
 * 批量转换消息
 */
export function toGeminiContents(messages: UnifiedMessage[]): Content[] {
  return messages
    .filter(msg => msg.role !== 'system')  // 过滤 system 消息
    .map(toGeminiContent);
}

/**
 * 批量转换 Gemini 内容
 */
export function fromGeminiContents(contents: Content[]): UnifiedMessage[] {
  return contents.map(fromGeminiContent);
}

// ==================== Tool 转换 ====================

/**
 * 统一工具模式转换为 Gemini FunctionDeclaration
 */
export function toGeminiFunctionDeclaration(schema: UnifiedToolSchema): Record<string, unknown> {
  return {
    name: schema.name,
    description: schema.description,
    parameters: schema.parameters as Record<string, unknown>,
  };
}

/**
 * 统一工具结果转换为 Gemini 函数响应格式
 */
function toGeminiFunctionResponse(result: UnifiedToolResult): Record<string, unknown> {
  // 提取文本内容
  const textContent = result.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n');
  
  if (result.isError) {
    return { error: textContent || 'Unknown error' };
  }
  
  // 尝试解析为 JSON
  try {
    return JSON.parse(textContent);
  } catch {
    return { result: textContent };
  }
}

// ==================== 辅助函数 ====================

/**
 * 从 Gemini 响应中提取文本
 */
export function extractTextFromGeminiParts(parts: Part[]): string {
  return parts
    .filter(p => p.text !== undefined && !(p as Part & { thought?: boolean }).thought)
    .map(p => p.text)
    .join('');
}

/**
 * 从 Gemini 响应中提取工具调用
 */
export function extractToolCallsFromGeminiParts(parts: Part[]): UnifiedToolCall[] {
  return parts
    .filter(p => p.functionCall)
    .map(p => {
      const fnCall = p.functionCall!;
      return {
        id: (fnCall as FunctionCall & { id?: string }).id ||
            `${fnCall.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: fnCall.name || 'unknown',
        arguments: (fnCall.args || {}) as Record<string, unknown>,
      };
    });
}
