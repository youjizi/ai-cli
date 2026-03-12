/**
 * Property-based tests for HTTP client
 * **Feature: zai-typescript-sdk, Property 4: Request Header Construction**
 * **Validates: Requirements 2.1**
 * 
 * **Feature: zai-typescript-sdk, Property 5: Retry on Retryable Errors**
 * **Validates: Requirements 2.2, 2.3, 2.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { HttpClient } from '../src/core/http-client.js';
import { RETRYABLE_STATUS_CODES, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY } from '../src/core/constants.js';

// 生成有效的 API key（字母数字组合，无空格）
const apiKeyArb = fc.string({ minLength: 10, maxLength: 64 })
  .filter(s => /^[a-zA-Z0-9]+$/.test(s) && s.length >= 10);

// 生成有效的路径（字母数字和斜杠）
const pathArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => /^[a-zA-Z0-9\/_-]+$/.test(s) && s.length >= 1);

// 生成有效的 header 值（无空格开头结尾）
const headerValueArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s) && s.length >= 1);

describe('Property 4: Request Header Construction', () => {
  /**
   * Property: All HTTP requests include required headers
   * *For any* HTTP request made by the SDK, the request SHALL include
   * Authorization header with Bearer token, Content-Type header, and SDK version header.
   */
  it('all requests include Authorization, Content-Type, and SDK version headers', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH' as const),
        pathArb,
        (baseUrl, apiKey, method, path) => {
          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 2,
          });

          const request = client.buildRequest({
            method,
            path,
          });

          // 验证 Authorization 头包含 Bearer token
          const authHeader = request.headers.get('Authorization');
          expect(authHeader).toBe(`Bearer ${apiKey}`);

          // 验证 Content-Type 头
          const contentType = request.headers.get('Content-Type');
          expect(contentType).toBe('application/json; charset=UTF-8');

          // 验证 SDK 版本头
          const sdkVersion = request.headers.get('Zai-SDK-Ver');
          expect(sdkVersion).toBeTruthy();
          expect(typeof sdkVersion).toBe('string');

          // 验证 Accept 头
          const acceptHeader = request.headers.get('Accept');
          expect(acceptHeader).toBe('application/json');

          // 验证 source_type 头
          const sourceType = request.headers.get('source_type');
          expect(sourceType).toBe('z-ai-sdk-typescript');

          // 验证 x-request-sdk 头
          const xRequestSdk = request.headers.get('x-request-sdk');
          expect(xRequestSdk).toBe('z-ai-sdk-typescript');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Custom headers are merged with default headers
   */
  it('custom headers are merged with default headers', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        headerValueArb,
        pathArb,
        (baseUrl, apiKey, customHeaderValue, path) => {
          const customHeaders = {
            'X-Custom-Header': customHeaderValue,
          };

          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 2,
            customHeaders,
          });

          const request = client.buildRequest({
            method: 'GET',
            path,
          });

          // 验证自定义头被包含
          expect(request.headers.get('X-Custom-Header')).toBe(customHeaderValue);

          // 验证默认头仍然存在
          expect(request.headers.get('Authorization')).toBe(`Bearer ${apiKey}`);
          expect(request.headers.get('Content-Type')).toBe('application/json; charset=UTF-8');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Request-specific headers override defaults
   */
  it('request-specific headers override defaults', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        pathArb,
        (baseUrl, apiKey, path) => {
          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 2,
          });

          const customContentType = 'text/plain';
          const request = client.buildRequest({
            method: 'POST',
            path,
            headers: {
              'Content-Type': customContentType,
            },
          });

          // 验证请求级别的头覆盖了默认值
          expect(request.headers.get('Content-Type')).toBe(customContentType);

          // 验证其他默认头仍然存在
          expect(request.headers.get('Authorization')).toBe(`Bearer ${apiKey}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 5: Retry on Retryable Errors', () => {
  /**
   * Property: shouldRetry returns true for retryable status codes (429, 5xx)
   * *For any* request that receives a 429 or 5xx response, the HttpClient
   * SHALL identify it as retryable.
   */
  it('shouldRetry returns true for all retryable status codes', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        fc.constantFrom(...RETRYABLE_STATUS_CODES),
        (baseUrl, apiKey, statusCode) => {
          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 2,
          });

          // 验证可重试状态码返回 true
          expect(client.shouldRetry(statusCode, false)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: shouldRetry returns true for timeout errors
   * *For any* request that times out, the HttpClient SHALL retry.
   */
  it('shouldRetry returns true for timeout errors', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        fc.option(fc.integer({ min: 100, max: 599 }), { nil: null }),
        (baseUrl, apiKey, statusCode) => {
          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 2,
          });

          // 超时时应该重试，无论状态码是什么
          expect(client.shouldRetry(statusCode, true)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: shouldRetry returns false for non-retryable status codes
   * *For any* request that receives a non-retryable status code (e.g., 400, 401, 403, 404),
   * the HttpClient SHALL NOT retry.
   */
  it('shouldRetry returns false for non-retryable status codes', () => {
    // 非可重试状态码
    const nonRetryableStatusCodes = [200, 201, 204, 400, 401, 403, 404, 405, 409, 422];
    
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        fc.constantFrom(...nonRetryableStatusCodes),
        (baseUrl, apiKey, statusCode) => {
          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 2,
          });

          // 非可重试状态码应返回 false
          expect(client.shouldRetry(statusCode, false)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: calculateRetryDelay uses exponential backoff
   * *For any* retry attempt, the delay SHALL follow exponential backoff pattern
   * with delay = INITIAL_RETRY_DELAY * 2^attempt (with jitter).
   */
  it('calculateRetryDelay follows exponential backoff pattern', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        fc.integer({ min: 0, max: 10 }),
        (baseUrl, apiKey, attempt) => {
          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 5,
          });

          const delay = client.calculateRetryDelay(attempt);
          const expectedBase = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          
          // 延迟应该在基础值的 75% 到 100% 之间（由于抖动）
          const minExpected = Math.min(expectedBase * 0.75, MAX_RETRY_DELAY * 0.75);
          const maxExpected = Math.min(expectedBase, MAX_RETRY_DELAY);

          expect(delay).toBeGreaterThanOrEqual(minExpected);
          expect(delay).toBeLessThanOrEqual(maxExpected);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: calculateRetryDelay is capped at MAX_RETRY_DELAY
   * *For any* retry attempt, the delay SHALL NOT exceed MAX_RETRY_DELAY.
   */
  it('calculateRetryDelay is capped at MAX_RETRY_DELAY', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        fc.integer({ min: 0, max: 20 }),
        (baseUrl, apiKey, attempt) => {
          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 5,
          });

          const delay = client.calculateRetryDelay(attempt);
          
          // 延迟不应超过最大值
          expect(delay).toBeLessThanOrEqual(MAX_RETRY_DELAY);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: calculateRetryDelay increases with attempt number
   * *For any* two consecutive retry attempts, the expected delay for the later
   * attempt SHALL be greater than or equal to the earlier one (before jitter).
   */
  it('calculateRetryDelay generally increases with attempt number', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        fc.integer({ min: 0, max: 5 }),
        (baseUrl, apiKey, attempt) => {
          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 5,
          });

          // 计算多次以获取平均值（减少抖动影响）
          const samples = 10;
          let avgDelay1 = 0;
          let avgDelay2 = 0;
          
          for (let i = 0; i < samples; i++) {
            avgDelay1 += client.calculateRetryDelay(attempt);
            avgDelay2 += client.calculateRetryDelay(attempt + 1);
          }
          avgDelay1 /= samples;
          avgDelay2 /= samples;

          // 后续尝试的平均延迟应该更大（除非已达到上限）
          const expectedBase1 = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          const expectedBase2 = INITIAL_RETRY_DELAY * Math.pow(2, attempt + 1);
          
          if (expectedBase1 < MAX_RETRY_DELAY && expectedBase2 <= MAX_RETRY_DELAY) {
            // 如果两者都未达到上限，后者应该更大
            expect(avgDelay2).toBeGreaterThan(avgDelay1 * 0.8); // 允许一些抖动误差
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: calculateRetryDelay always returns positive value
   * *For any* retry attempt, the delay SHALL be a positive number.
   */
  it('calculateRetryDelay always returns positive value', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        apiKeyArb,
        fc.integer({ min: 0, max: 100 }),
        (baseUrl, apiKey, attempt) => {
          const client = new HttpClient(baseUrl, apiKey, {
            timeout: 10000,
            maxRetries: 5,
          });

          const delay = client.calculateRetryDelay(attempt);
          
          expect(delay).toBeGreaterThan(0);
          expect(Number.isFinite(delay)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
