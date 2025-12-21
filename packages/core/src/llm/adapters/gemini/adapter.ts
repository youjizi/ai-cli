/**
 * Gemini 适配器
 * 
 * 实现 LLMProviderAdapter 接口，封装 Google Gemini SDK
 * Requirements: 5.1, 5.3
 */

import type { GoogleGenAI, GenerateContentResponse, Tool } from '@google/genai';
import type {
  LLMProviderAdapter,
  AdapterCapabilities,
  UnifiedGenerateRequest,
  UnifiedGenerateResponse,
  UnifiedCountTokensRequest,
  UnifiedCountTokensResponse,
} from '../../adapter/interface.js';
import type { UnifiedStreamEvent, UnifiedMessage } from '../../types/index.js';
import { UnifiedFinishReason, mapGeminiFinishReason } from '../../types/stream.js';
import {
  toGeminiContents,
  toGeminiFunctionDeclaration,
  extractTextFromGeminiParts,
  extractToolCallsFromGeminiParts,
} from './converter.js';
import { processGeminiStream } from './stream-processor.js';
import { UnsupportedOperationError } from '../../utils/errors.js';

/**
 * Gemini 适配器配置
 */
export interface GeminiAdapterConfig {
  /** 默认模型 */
  defaultModel?: string;
}

/**
 * Google Gemini LLM 适配器
 */
export class GeminiAdapter implements LLMProviderAdapter {
  readonly providerId = 'gemini';
  
  readonly capabilities: AdapterCapabilities = {
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    supportsEmbedding: true,
    supportsSystemMessage: true,
    maxContextLength: 1000000,  // Gemini 2.0 支持 1M tokens
  };

  constructor(
    private readonly client: GoogleGenAI,
    private readonly config: GeminiAdapterConfig = {},
  ) {}

  /**
   * 生成内容 (非流式)
   */
  async generateContent(
    request: UnifiedGenerateRequest,
    promptId: string,
  ): Promise<UnifiedGenerateResponse> {
    const model = request.model || this.config.defaultModel || 'gemini-2.0-flash';
    const contents = toGeminiContents(request.messages);
    
    // 构建工具配置
    const tools = this.buildTools(request);
    
    // 构建生成配置
    const generateConfig = this.buildGenerateConfig(request);
    
    const response = await this.client.models.generateContent({
      model,
      contents,
      config: {
        ...generateConfig,
        systemInstruction: request.systemInstruction,
        tools,
        abortSignal: request.abortSignal,
      },
    });

    return this.convertResponse(response);
  }

  /**
   * 生成内容 (流式)
   */
  async *generateContentStream(
    request: UnifiedGenerateRequest,
    promptId: string,
  ): AsyncGenerator<UnifiedStreamEvent> {
    const model = request.model || this.config.defaultModel || 'gemini-2.0-flash';
    const contents = toGeminiContents(request.messages);
    
    // 构建工具配置
    const tools = this.buildTools(request);
    
    // 构建生成配置
    const generateConfig = this.buildGenerateConfig(request);
    
    const stream = await this.client.models.generateContentStream({
      model,
      contents,
      config: {
        ...generateConfig,
        systemInstruction: request.systemInstruction,
        tools,
        abortSignal: request.abortSignal,
      },
    });

    // 使用流处理器转换事件
    yield* processGeminiStream(stream);
  }

  /**
   * 计算 token 数量
   */
  async countTokens(
    request: UnifiedCountTokensRequest,
  ): Promise<UnifiedCountTokensResponse> {
    const model = request.model || this.config.defaultModel || 'gemini-2.0-flash';
    const contents = toGeminiContents(request.messages);
    
    const response = await this.client.models.countTokens({
      model,
      contents,
    });

    return {
      totalTokens: response.totalTokens || 0,
    };
  }

  /**
   * 生成嵌入向量
   */
  async embedContent(texts: string[]): Promise<number[][]> {
    if (!this.capabilities.supportsEmbedding) {
      throw new UnsupportedOperationError(this.providerId, 'embedContent');
    }

    const embeddings: number[][] = [];
    
    // Gemini 嵌入 API 需要逐个处理
    for (const text of texts) {
      const response = await this.client.models.embedContent({
        model: 'text-embedding-004',
        contents: [{ role: 'user', parts: [{ text }] }],
      });
      
      if (response.embeddings?.[0]?.values) {
        embeddings.push(response.embeddings[0].values);
      } else {
        embeddings.push([]);
      }
    }

    return embeddings;
  }

  // ==================== 私有方法 ====================

  /**
   * 构建工具配置
   */
  private buildTools(request: UnifiedGenerateRequest): Tool[] | undefined {
    if (!request.tools || request.tools.length === 0) {
      return undefined;
    }

    return [{
      functionDeclarations: request.tools.map(toGeminiFunctionDeclaration),
    }] as Tool[];
  }

  /**
   * 构建生成配置
   */
  private buildGenerateConfig(request: UnifiedGenerateRequest): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    if (request.temperature !== undefined) {
      config['temperature'] = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      config['maxOutputTokens'] = request.maxTokens;
    }
    if (request.topP !== undefined) {
      config['topP'] = request.topP;
    }
    if (request.topK !== undefined) {
      config['topK'] = request.topK;
    }
    if (request.stopSequences !== undefined) {
      config['stopSequences'] = request.stopSequences;
    }
    if (request.responseFormat === 'json') {
      config['responseMimeType'] = 'application/json';
      if (request.responseSchema) {
        config['responseSchema'] = request.responseSchema;
      }
    }

    // 工具选择模式
    if (request.toolChoice) {
      if (request.toolChoice === 'none') {
        config['toolConfig'] = { functionCallingConfig: { mode: 'NONE' } };
      } else if (request.toolChoice === 'required') {
        config['toolConfig'] = { functionCallingConfig: { mode: 'ANY' } };
      } else if (typeof request.toolChoice === 'object' && request.toolChoice.name) {
        config['toolConfig'] = {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: [request.toolChoice.name],
          },
        };
      }
      // 'auto' 是默认行为，不需要设置
    }

    return config;
  }

  /**
   * 转换响应
   */
  private convertResponse(response: GenerateContentResponse): UnifiedGenerateResponse {
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    
    // 提取文本和工具调用
    const text = extractTextFromGeminiParts(parts);
    const toolCalls = extractToolCallsFromGeminiParts(parts);
    
    // 构建消息内容
    const content: UnifiedMessage['content'] = [];
    if (text) {
      content.push({ type: 'text', text });
    }
    for (const tc of toolCalls) {
      content.push({ type: 'toolCall', toolCall: tc });
    }
    
    // 提取 metadata
    const metadata: Record<string, unknown> = {};
    const thoughtPart = parts.find(
      (p) => (p as { thought?: boolean })['thought']
    );
    if (thoughtPart && 'text' in thoughtPart) {
      metadata['thought'] = thoughtPart.text;
    }
    if (response.responseId) {
      metadata['responseId'] = response.responseId;
    }

    // 完成原因
    const finishReason = candidate?.finishReason
      ? mapGeminiFinishReason(candidate.finishReason)
      : UnifiedFinishReason.Stop;

    // 使用量
    const usage = response.usageMetadata
      ? {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        }
      : undefined;

    return {
      message: {
        role: 'assistant',
        content,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
      finishReason,
      usage,
      metadata,
    };
  }
}

/**
 * 创建 Gemini 适配器
 */
export function createGeminiAdapter(
  client: GoogleGenAI,
  config?: GeminiAdapterConfig,
): GeminiAdapter {
  return new GeminiAdapter(client, config);
}
