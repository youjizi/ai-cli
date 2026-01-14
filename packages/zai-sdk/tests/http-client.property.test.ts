/**
 * Property-based tests for HTTP client
 * **Feature: zai-typescript-sdk, Property 4: Request Header Construction**
 * **Validates: Requirements 2.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { HttpClient } from '../src/core/http-client.js';

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
