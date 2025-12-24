/**
 * 适配器错误基类
 *
 * 所有适配器相关错误的基类
 * 保留原始错误信息便于调试
 */
export class AdapterError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public override readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'AdapterError';
    }
}

/**
 * 提供商未找到错误
 *
 * 当请求的 providerId 未注册时抛出
 */
export class ProviderNotFoundError extends Error {
    constructor(public readonly providerId: string) {
        super(`Provider "${providerId}" not found`);
        this.name = 'ProviderNotFoundError';
    }
}