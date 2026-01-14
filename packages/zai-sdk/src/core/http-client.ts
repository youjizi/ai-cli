/**
 * Z.ai SDK HTTP 客户端
 * 处理请求构建、重试逻辑和错误处理
 */

import {
  DEFAULT_TIMEOUT,
  DEFAULT_MAX_RETRIES,
  INITIAL_RETRY_DELAY,
  MAX_RETRY_DELAY,
  RETRYABLE_STATUS_CODES,
} from './constants.js';
import {
  ZaiError,
  APIStatusError,
  APIConnectionError,
  APITimeoutError,
  makeStatusError,
} from './errors.js';

/** SDK 版本号 */
const SDK_VERSION = '1.0.0';

/** HTTP 请求方法类型 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** 请求选项接口 */
export interface RequestOptions {
  /** HTTP 方法 */
  method: HttpMethod;
  /** 请求路径 */
  path: string;
  /** 请求体 */
  body?: unknown;
  /** 查询参数 */
  query?: Record<string, unknown>;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 是否为流式请求 */
  stream?: boolean;
}

/** 最终请求选项（包含重试配置） */
export interface FinalRequestOptions extends RequestOptions {
  /** 最大重试次数 */
  maxRetries?: number;
}

/** HTTP 客户端配置选项 */
export interface HttpClientOptions {
  /** 请求超时时间（毫秒） */
  timeout: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 自定义请求头 */
  customHeaders?: Record<string, string>;
}


/**
 * HTTP 客户端类
 * 负责构建请求、处理重试和错误映射
 */
export class HttpClient {
  /** API 基础 URL */
  private readonly baseUrl: string;
  /** API 密钥 */
  private readonly apiKey: string;
  /** 请求超时时间（毫秒） */
  private readonly timeout: number;
  /** 最大重试次数 */
  private readonly maxRetries: number;
  /** 自定义请求头 */
  private readonly customHeaders: Record<string, string>;

  constructor(
    baseUrl: string,
    apiKey: string,
    options: HttpClientOptions
  ) {
    // 确保 baseUrl 以 / 结尾
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.apiKey = apiKey;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.customHeaders = options.customHeaders ?? {};
  }

  /**
   * 构建默认请求头
   * 包含 Authorization, Content-Type, SDK 版本等
   */
  private buildDefaultHeaders(): Record<string, string> {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': `Bearer ${this.apiKey}`,
      'Zai-SDK-Ver': SDK_VERSION,
      'source_type': 'z-ai-sdk-typescript',
      'x-request-sdk': 'z-ai-sdk-typescript',
      ...this.customHeaders,
    };
  }

  /**
   * 准备请求 URL
   * @param path 请求路径
   * @param query 查询参数
   */
  private prepareUrl(path: string, query?: Record<string, unknown>): string {
    // 移除路径开头的斜杠
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    let url = `${this.baseUrl}${cleanPath}`;

    if (query && Object.keys(query).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return url;
  }

  /**
   * 构建 Request 对象
   * @param options 请求选项
   */
  buildRequest(options: FinalRequestOptions): Request {
    const url = this.prepareUrl(options.path, options.query);
    const headers = {
      ...this.buildDefaultHeaders(),
      ...options.headers,
    };

    const init: RequestInit = {
      method: options.method,
      headers,
    };

    // 添加请求体（GET 和 DELETE 通常不需要）
    if (options.body !== undefined && options.method !== 'GET') {
      init.body = JSON.stringify(options.body);
    }

    return new Request(url, init);
  }


  /**
   * 判断是否应该重试请求
   * @param status HTTP 状态码
   * @param isTimeout 是否为超时错误
   */
  shouldRetry(status: number | null, isTimeout: boolean = false): boolean {
    // 超时应该重试
    if (isTimeout) {
      return true;
    }

    // 检查状态码是否在可重试列表中
    if (status !== null) {
      return (RETRYABLE_STATUS_CODES as readonly number[]).includes(status);
    }

    return false;
  }

  /**
   * 计算重试延迟时间（指数退避）
   * @param attempt 当前重试次数（从 0 开始）
   */
  calculateRetryDelay(attempt: number): number {
    // 指数退避: initialDelay * 2^attempt
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
    // 添加抖动（±25%）
    const jitter = 1 - 0.25 * Math.random();
    const finalDelay = delay * jitter;
    // 限制最大延迟
    return Math.min(finalDelay, MAX_RETRY_DELAY);
  }

  /**
   * 执行 HTTP 请求（带重试逻辑）
   * @param options 请求选项
   */
  async request<T>(options: FinalRequestOptions): Promise<T> {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const timeout = options.timeout ?? this.timeout;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const request = this.buildRequest(options);

      try {
        // 创建超时控制器
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(request.url, {
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body: options.body !== undefined && options.method !== 'GET' 
              ? JSON.stringify(options.body) 
              : undefined,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // 检查响应状态
          if (!response.ok) {
            const body = await response.text();
            
            // 判断是否应该重试
            if (attempt < maxRetries && this.shouldRetry(response.status)) {
              const delay = this.calculateRetryDelay(attempt);
              await this.sleep(delay);
              continue;
            }

            // 不重试，抛出对应的错误
            throw makeStatusError(response.status, response.headers, body);
          }

          // 解析响应
          const data = await response.json();
          return data as T;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        // 处理超时错误
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < maxRetries && this.shouldRetry(null, true)) {
            const delay = this.calculateRetryDelay(attempt);
            await this.sleep(delay);
            lastError = new APITimeoutError(request);
            continue;
          }
          throw new APITimeoutError(request);
        }

        // 处理已知的 API 错误
        if (error instanceof APIStatusError) {
          throw error;
        }

        // 处理连接错误
        if (error instanceof TypeError || (error instanceof Error && error.message.includes('fetch'))) {
          if (attempt < maxRetries) {
            const delay = this.calculateRetryDelay(attempt);
            await this.sleep(delay);
            lastError = new APIConnectionError(`Connection failed: ${error.message}`, request);
            continue;
          }
          throw new APIConnectionError(`Connection failed: ${error.message}`, request);
        }

        // 其他错误直接抛出
        throw error;
      }
    }

    // 所有重试都失败
    if (lastError) {
      throw lastError;
    }

    throw new ZaiError('Request failed after all retries');
  }

  /**
   * 延迟执行
   * @param ms 延迟毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取基础 URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * 获取 API 密钥
   */
  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * 获取超时时间
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * 获取最大重试次数
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }
}
