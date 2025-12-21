/**
 * 延迟工具函数
 */

/**
 * 创建一个可取消的延迟
 * @param ms 延迟毫秒数
 * @param signal 可选的 AbortSignal 用于取消
 */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timeoutId);
        reject(createAbortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * 创建一个标准的 AbortError
 */
export function createAbortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * 检查错误是否为 AbortError
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
