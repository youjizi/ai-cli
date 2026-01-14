/**
 * Z.ai SDK 默认常量配置
 */

/** 默认请求超时时间（毫秒），10 分钟 */
export const DEFAULT_TIMEOUT = 600_000;

/** 默认最大重试次数 */
export const DEFAULT_MAX_RETRIES = 2;

/** 默认限制配置 */
export const DEFAULT_LIMITS = {
  /** 聊天补全的最大 token 数 */
  maxTokens: 4096,
  /** 单次请求的最大消息数 */
  maxMessages: 100,
} as const;

/** 首次重试前的初始延迟时间（毫秒） */
export const INITIAL_RETRY_DELAY = 500;

/** 重试之间的最大延迟时间（毫秒） */
export const MAX_RETRY_DELAY = 8000;

/** 应触发重试的 HTTP 状态码 */
export const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504] as const;
