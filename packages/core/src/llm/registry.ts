import type {LLMAdapter} from "./adapter.js";
import {ProviderNotFoundError} from "./errors.js";

export class ProviderRegistry {

    private adapters = new Map<string, LLMAdapter>();

    /**
     * 注册适配器
     */
    register(adapter: LLMAdapter): void {
        this.adapters.set(adapter.providerId, adapter);
    }

    /**
     * 获取适配器
     * @throws ProviderNotFoundError 如果未找到
     */
    get(providerId: string): LLMAdapter {
        const adapter = this.adapters.get(providerId);
        if (!adapter) {
            throw new ProviderNotFoundError(providerId);
        }
        return adapter;
    }

    /**
     * 检查是否存在
     */
    has(providerId: string): boolean {
        return this.adapters.has(providerId);
    }

    /**
     * 列出所有已注册的提供商
     */
    list(): string[] {
        return Array.from(this.adapters.keys());
    }
}
/**
 * 全局单例
 *
 * 整个应用共享一个注册表
 */
export const registry = new ProviderRegistry();
