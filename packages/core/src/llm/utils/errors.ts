/**
 * LLM 统一错误类型
 * 
 * 提供跨提供商的标准化错误处理
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

/**
 * 统一 LLM 错误基类
 */
export class UnifiedLLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly retryable: boolean,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'UnifiedLLMError';
    // 确保 instanceof 正常工作
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 提供商未找到错误
 */
export class ProviderNotFoundError extends UnifiedLLMError {
  constructor(providerId: string) {
    super(
      `Provider '${providerId}' not found in registry`,
      'PROVIDER_NOT_FOUND',
      providerId,
      false,
    );
    this.name = 'ProviderNotFoundError';
  }
}

/**
 * 认证失败错误 (401/403)
 */
export class AuthenticationError extends UnifiedLLMError {
  constructor(
    provider: string,
    message: string = 'Authentication failed',
    originalError?: unknown,
  ) {
    super(message, 'AUTHENTICATION_ERROR', provider, false, originalError);
    this.name = 'AuthenticationError';
  }
}

/**
 * 速率限制错误 (429)
 */
export class RateLimitError extends UnifiedLLMError {
  constructor(
    provider: string,
    public readonly retryAfter?: number,
    message: string = 'Rate limit exceeded',
    originalError?: unknown,
  ) {
    super(message, 'RATE_LIMIT_ERROR', provider, true, originalError);
    this.name = 'RateLimitError';
  }
}

/**
 * 不支持的操作错误
 */
export class UnsupportedOperationError extends UnifiedLLMError {
  constructor(
    provider: string,
    operation: string,
    message?: string,
  ) {
    super(
      message ?? `Operation '${operation}' is not supported by provider '${provider}'`,
      'UNSUPPORTED_OPERATION',
      provider,
      false,
    );
    this.name = 'UnsupportedOperationError';
  }
}

/**
 * 模型不可用错误
 */
export class ModelNotAvailableError extends UnifiedLLMError {
  constructor(
    provider: string,
    model: string,
    originalError?: unknown,
  ) {
    super(
      `Model '${model}' is not available for provider '${provider}'`,
      'MODEL_NOT_AVAILABLE',
      provider,
      false,
      originalError,
    );
    this.name = 'ModelNotAvailableError';
  }
}

/**
 * 内容过滤错误 (安全策略拦截)
 */
export class ContentFilterError extends UnifiedLLMError {
  constructor(
    provider: string,
    public readonly filterReason?: string,
    originalError?: unknown,
  ) {
    super(
      filterReason ? `Content blocked: ${filterReason}` : 'Content blocked by safety filter',
      'CONTENT_FILTER',
      provider,
      false,
      originalError,
    );
    this.name = 'ContentFilterError';
  }
}

/**
 * 上下文长度超限错误
 */
export class ContextLengthExceededError extends UnifiedLLMError {
  constructor(
    provider: string,
    public readonly maxTokens?: number,
    public readonly requestedTokens?: number,
    originalError?: unknown,
  ) {
    const details = maxTokens && requestedTokens
      ? ` (max: ${maxTokens}, requested: ${requestedTokens})`
      : '';
    super(
      `Context length exceeded${details}`,
      'CONTEXT_LENGTH_EXCEEDED',
      provider,
      false,
      originalError,
    );
    this.name = 'ContextLengthExceededError';
  }
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof UnifiedLLMError) {
    return error.retryable;
  }
  // 检查 HTTP 状态码
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return status === 429 || (status >= 500 && status < 600);
  }
  return false;
}

/**
 * 从原始错误创建统一错误
 */
export function createUnifiedError(
  provider: string,
  error: unknown,
): UnifiedLLMError {
  if (error instanceof UnifiedLLMError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  
  // 尝试从错误中提取 HTTP 状态码
  let status: number | undefined;
  if (error && typeof error === 'object') {
    if ('status' in error) status = (error as { status: number }).status;
    else if ('statusCode' in error) status = (error as { statusCode: number }).statusCode;
  }

  // 根据状态码创建对应错误
  if (status === 401 || status === 403) {
    return new AuthenticationError(provider, message, error);
  }
  if (status === 429) {
    // 尝试提取 retry-after
    let retryAfter: number | undefined;
    if (error && typeof error === 'object' && 'headers' in error) {
      const headers = (error as { headers: Record<string, string> }).headers;
      const retryAfterHeader = headers?.['retry-after'];
      if (retryAfterHeader) {
        retryAfter = parseInt(retryAfterHeader, 10) * 1000;
      }
    }
    return new RateLimitError(provider, retryAfter, message, error);
  }

  // 默认返回通用错误
  const retryable = status !== undefined && status >= 500 && status < 600;
  return new UnifiedLLMError(message, 'UNKNOWN_ERROR', provider, retryable, error);
}
