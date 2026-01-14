/**
 * Z.ai SDK 错误类
 * 实现了针对不同 API 失败场景的错误类层次结构
 */

/**
 * Z.ai SDK 所有错误的基类
 */
export class ZaiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZaiError';
    // 保持正确的堆栈跟踪（仅在 V8 引擎中有效）
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * HTTP 状态错误的基类
 */
export class APIStatusError extends ZaiError {
  /** HTTP 状态码 */
  readonly status: number;
  /** 响应头 */
  readonly headers: Headers;
  /** 响应体 */
  readonly body: string;

  constructor(message: string, status: number, headers: Headers, body: string) {
    super(message);
    this.name = 'APIStatusError';
    this.status = status;
    this.headers = headers;
    this.body = body;
  }
}

/**
 * 400 Bad Request 错误
 * 请求参数错误或格式不正确
 */
export class APIRequestFailedError extends APIStatusError {
  constructor(message: string, status: number, headers: Headers, body: string) {
    super(message, status, headers, body);
    this.name = 'APIRequestFailedError';
  }
}

/**
 * 401 Unauthorized 错误
 * API Key 无效或未提供
 */
export class APIAuthenticationError extends APIStatusError {
  constructor(message: string, status: number, headers: Headers, body: string) {
    super(message, status, headers, body);
    this.name = 'APIAuthenticationError';
  }
}


/**
 * 429 Rate Limit 错误
 * 请求频率超过限制
 */
export class APIReachLimitError extends APIStatusError {
  constructor(message: string, status: number, headers: Headers, body: string) {
    super(message, status, headers, body);
    this.name = 'APIReachLimitError';
  }
}

/**
 * 500 Internal Server Error 错误
 * 服务器内部错误
 */
export class APIInternalError extends APIStatusError {
  constructor(message: string, status: number, headers: Headers, body: string) {
    super(message, status, headers, body);
    this.name = 'APIInternalError';
  }
}

/**
 * 503 Service Unavailable 错误
 * 服务器流量超载或暂时不可用
 */
export class APIServerFlowExceedError extends APIStatusError {
  constructor(message: string, status: number, headers: Headers, body: string) {
    super(message, status, headers, body);
    this.name = 'APIServerFlowExceedError';
  }
}

/**
 * 连接错误
 * 无法建立与服务器的连接
 */
export class APIConnectionError extends ZaiError {
  /** 原始请求对象 */
  readonly request: Request;

  constructor(message: string, request: Request) {
    super(message);
    this.name = 'APIConnectionError';
    this.request = request;
  }
}

/**
 * 请求超时错误
 * 请求在指定时间内未完成
 */
export class APITimeoutError extends APIConnectionError {
  constructor(request: Request) {
    super('Request timed out.', request);
    this.name = 'APITimeoutError';
  }
}

/**
 * 响应验证错误
 * API 返回的数据格式不符合预期
 */
export class APIResponseValidationError extends ZaiError {
  /** HTTP 状态码 */
  readonly status: number;
  /** 响应头 */
  readonly headers: Headers;
  /** 响应体 */
  readonly body: unknown;

  constructor(status: number, headers: Headers, body: unknown, message?: string) {
    super(message ?? 'Data returned by API invalid for expected schema.');
    this.name = 'APIResponseValidationError';
    this.status = status;
    this.headers = headers;
    this.body = body;
  }
}

/**
 * 根据 HTTP 状态码创建对应的错误类实例
 * @param status HTTP 状态码
 * @param headers 响应头
 * @param body 响应体
 * @returns 对应的错误类实例
 */
export function makeStatusError(
  status: number,
  headers: Headers,
  body: string
): APIStatusError {
  const message = `Error code: ${status}, with error text ${body}`;

  switch (status) {
    case 400:
      return new APIRequestFailedError(message, status, headers, body);
    case 401:
      return new APIAuthenticationError(message, status, headers, body);
    case 429:
      return new APIReachLimitError(message, status, headers, body);
    case 500:
      return new APIInternalError(message, status, headers, body);
    case 503:
      return new APIServerFlowExceedError(message, status, headers, body);
    default:
      return new APIStatusError(message, status, headers, body);
  }
}
