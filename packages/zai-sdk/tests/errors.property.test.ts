/**
 * Property-based tests for error class hierarchy
 * **Feature: zai-typescript-sdk, Property 7: Error Class Hierarchy**
 * **Validates: Requirements 5.8**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ZaiError,
  APIStatusError,
  APIRequestFailedError,
  APIAuthenticationError,
  APIReachLimitError,
  APIInternalError,
  APIServerFlowExceedError,
  APIConnectionError,
  APITimeoutError,
  APIResponseValidationError,
} from '../src/core/errors.js';

describe('Property 7: Error Class Hierarchy', () => {
  /**
   * Property: All API status error classes extend ZaiError
   * *For all* error classes (APIRequestFailedError, APIAuthenticationError, etc.),
   * they SHALL extend the base ZaiError class.
   */
  it('all APIStatusError subclasses extend ZaiError', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 100, max: 599 }),
        fc.string(),
        (message, status, body) => {
          const headers = new Headers();
          
          const errors = [
            new APIStatusError(message, status, headers, body),
            new APIRequestFailedError(message, status, headers, body),
            new APIAuthenticationError(message, status, headers, body),
            new APIReachLimitError(message, status, headers, body),
            new APIInternalError(message, status, headers, body),
            new APIServerFlowExceedError(message, status, headers, body),
          ];

          for (const error of errors) {
            expect(error).toBeInstanceOf(ZaiError);
            expect(error).toBeInstanceOf(Error);
          }
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property: APIConnectionError and its subclasses extend ZaiError
   */
  it('APIConnectionError and APITimeoutError extend ZaiError', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.webUrl(),
        (message, url) => {
          const request = new Request(url);
          
          const connectionError = new APIConnectionError(message, request);
          const timeoutError = new APITimeoutError(request);

          expect(connectionError).toBeInstanceOf(ZaiError);
          expect(connectionError).toBeInstanceOf(Error);
          expect(timeoutError).toBeInstanceOf(ZaiError);
          expect(timeoutError).toBeInstanceOf(APIConnectionError);
          expect(timeoutError).toBeInstanceOf(Error);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: APIResponseValidationError extends ZaiError
   */
  it('APIResponseValidationError extends ZaiError', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 599 }),
        fc.jsonValue(),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        (status, body, message) => {
          const headers = new Headers();
          const error = new APIResponseValidationError(status, headers, body, message);

          expect(error).toBeInstanceOf(ZaiError);
          expect(error).toBeInstanceOf(Error);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error properties are correctly preserved
   */
  it('error properties are correctly preserved', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 100, max: 599 }),
        fc.string(),
        (message, status, body) => {
          const headers = new Headers({ 'Content-Type': 'application/json' });
          const error = new APIStatusError(message, status, headers, body);

          expect(error.message).toBe(message);
          expect(error.status).toBe(status);
          expect(error.body).toBe(body);
          expect(error.headers.get('Content-Type')).toBe('application/json');
        }
      ),
      { numRuns: 100 }
    );
  });
});
