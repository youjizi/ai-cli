/**
 * 重试机制
 * 
 * 实现指数退避重试策略
 * Requirements: 9.5
 */

import { delay, isAbortError } from './delay.js';
import { isRetryableError, RateLimitError } from './errors.js';

/**
 * 重试配置选项
 */
export interface RetryOptions {
  /** 最大重试次数，默认 3 */
  maxAttempts: number;
  /** 初始延迟毫秒数，默认 5000 */
  initialDelayMs: number;
  /** 最大延迟毫秒数，默认 30000 */
  maxDelayMs: number;
  /** 自定义重试条件判断 */
  shouldRetryOnError?: (error: Error) => boolean;
  /** 用于取消重试的 AbortSignal */
  signal?: AbortSignal;
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 5000,
  maxDelayMs: 30000,
};

/**
 * 计算带抖动的退避延迟
 * 
 * @param attempt 当前尝试次数 (从 0 开始)
 * @param initialDelayMs 初始延迟
 * @param maxDelayMs 最大延迟
 * @returns 计算后的延迟毫秒数
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
): number {
  // 指数退避: delay = initialDelay * 2^attempt
  const exponentialDelay = initialDelayMs * Math.pow(2, attempt);
  // 限制最大延迟
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  // 添加 ±30% 的抖动
  const jitter = cappedDelay * 0.3 * (Math.random() * 2 - 1);
  return Math.max(0, cappedDelay + jitter);
}

/**
 * 默认的重试条件判断
 */
export function defaultShouldRetry(error: Error): boolean {
  return isRetryableError(error);
}

/**
 * 带指数退避的重试执行器
 * 
 * @param fn 要执行的异步函数
 * @param options 重试配置
 * @returns 函数执行结果
 * @throws 最后一次失败的错误
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const shouldRetry = opts.shouldRetryOnError ?? defaultShouldRetry;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    // 检查是否已取消
    if (opts.signal?.aborted) {
      throw isAbortError(lastError) ? lastError : new Error('The operation was aborted');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 如果是 AbortError，直接抛出不重试
      if (isAbortError(error)) {
        throw error;
      }

      // 检查是否应该重试
      const isLastAttempt = attempt === opts.maxAttempts - 1;
      if (isLastAttempt || !shouldRetry(lastError)) {
        throw lastError;
      }

      // 计算延迟时间
      let delayMs: number;
      
      // 如果是 RateLimitError 且有 retryAfter，使用它
      if (lastError instanceof RateLimitError && lastError.retryAfter) {
        delayMs = lastError.retryAfter;
      } else {
        delayMs = calculateBackoffDelay(attempt, opts.initialDelayMs, opts.maxDelayMs);
      }

      // 等待后重试
      await delay(delayMs, opts.signal);
    }
  }

  // 理论上不会到达这里，但 TypeScript 需要
  throw lastError ?? new Error('Retry failed');
}

/**
 * 创建一个带重试的函数包装器
 */
export function withRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: Partial<RetryOptions> = {},
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => retryWithBackoff(() => fn(...args), options);
}
