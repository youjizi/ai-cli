/**
 * LLM 适配器接口
 * 
 * 定义所有 LLM 提供商适配器必须实现的契约
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import type {
  UnifiedMessage,
  UnifiedToolSchema,
  UnifiedToolChoice,
  UnifiedStreamEvent,
  UnifiedFinishReason,
} from '../types/index.js';

/**
 * 适配器能力声明
 */
export interface AdapterCapabilities {
  /** 是否支持流式响应 */
  supportsStreaming: boolean;
  /** 是否支持工具调用 */
  supportsToolCalls: boolean;
  /** 是否支持视觉 (图片输入) */
  supportsVision: boolean;
  /** 是否支持嵌入 */
  supportsEmbedding: boolean;
  /** 是否支持系统消息 */
  supportsSystemMessage: boolean;
  /** 最大上下文长度 (token) */
  maxContextLength?: number;
}

/**
 * 统一生成请求
 */
export interface UnifiedGenerateRequest {
  /** 模型名称 */
  model: string;
  /** 消息历史 */
  messages: UnifiedMessage[];
  /** 系统指令 */
  systemInstruction?: string;
  /** 可用工具 */
  tools?: UnifiedToolSchema[];
  /** 工具选择模式 */
  toolChoice?: UnifiedToolChoice;
  /** 温度 (0-2) */
  temperature?: number;
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** Top-P 采样 */
  topP?: number;
  /** Top-K 采样 */
  topK?: number;
  /** 停止序列 */
  stopSequences?: string[];
  /** 响应格式 */
  responseFormat?: 'text' | 'json';
  /** JSON 响应模式的 schema */
  responseSchema?: Record<string, unknown>;
  /** 取消信号 */
  abortSignal?: AbortSignal;
}

/**
 * Token 使用量
 */
export interface UnifiedUsage {
  /** 输入 token 数 */
  promptTokens: number;
  /** 输出 token 数 */
  completionTokens: number;
  /** 总 token 数 */
  totalTokens: number;
}

/**
 * 统一生成响应
 */
export interface UnifiedGenerateResponse {
  /** 响应消息 */
  message: UnifiedMessage;
  /** 完成原因 */
  finishReason: UnifiedFinishReason;
  /** Token 使用量 */
  usage?: UnifiedUsage;
  /** 元数据 (提供商特有信息) */
  metadata?: Record<string, unknown>;
}

/**
 * Token 计数请求
 */
export interface UnifiedCountTokensRequest {
  /** 模型名称 */
  model: string;
  /** 消息列表 */
  messages: UnifiedMessage[];
}

/**
 * Token 计数响应
 */
export interface UnifiedCountTokensResponse {
  /** 总 token 数 */
  totalTokens: number;
}

/**
 * LLM 提供商适配器接口
 * 
 * 所有 LLM 提供商适配器必须实现此接口
 */
export interface LLMProviderAdapter {
  /** 提供商唯一标识 */
  readonly providerId: string;
  
  /** 适配器能力声明 */
  readonly capabilities: AdapterCapabilities;

  /**
   * 生成内容 (非流式)
   * 
   * @param request 生成请求
   * @param promptId 提示 ID (用于追踪)
   * @returns 生成响应
   */
  generateContent(
    request: UnifiedGenerateRequest,
    promptId: string,
  ): Promise<UnifiedGenerateResponse>;

  /**
   * 生成内容 (流式)
   * 
   * @param request 生成请求
   * @param promptId 提示 ID (用于追踪)
   * @yields 流式事件
   */
  generateContentStream(
    request: UnifiedGenerateRequest,
    promptId: string,
  ): AsyncGenerator<UnifiedStreamEvent>;

  /**
   * 计算 token 数量
   * 
   * @param request 计数请求
   * @returns 计数响应
   */
  countTokens(
    request: UnifiedCountTokensRequest,
  ): Promise<UnifiedCountTokensResponse>;

  /**
   * 生成嵌入向量 (可选)
   * 
   * @param texts 文本列表
   * @returns 嵌入向量列表
   */
  embedContent?(texts: string[]): Promise<number[][]>;
}

// ==================== 辅助类型 ====================

/**
 * 适配器工厂函数类型
 */
export type AdapterFactory<TConfig = unknown> = (config: TConfig) => LLMProviderAdapter;

/**
 * 适配器注册信息
 */
export interface AdapterRegistration<TConfig = unknown> {
  /** 提供商 ID */
  providerId: string;
  /** 显示名称 */
  displayName: string;
  /** 工厂函数 */
  factory: AdapterFactory<TConfig>;
  /** 默认配置 */
  defaultConfig?: Partial<TConfig>;
}
