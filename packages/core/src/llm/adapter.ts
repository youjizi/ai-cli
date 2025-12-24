import type {GenerateRequest, GenerateResponse, Message} from "./types.js";
import type {StreamEvent} from "./stream.js";


/**
 * 适配器能力声明
 *
 * 不同厂商支持的功能不同，通过能力声明让上层知道
 */
export interface AdapterCapabilities {
    /** 是否支持流式响应 */
    streaming: boolean;
    /** 是否支持工具调用 */
    toolCalls: boolean;
    /** 是否支持图片输入 */
    vision: boolean;
    /** 是否支持系统消息 */
    systemMessage: boolean;
}

/**
 * LLM 适配器接口
 *
 * 所有厂商适配器必须实现此接口
 * 这是整个适配层的核心契约
 */
export interface LLMAdapter {
    /** 提供商 ID，如 'gemini', 'openai' */
    readonly providerId: string;

    /** 能力声明 */
    readonly capabilities: AdapterCapabilities;

    /**
     * 生成（非流式）
     *
     * @param request - 统一请求
     * @returns 统一响应
     */
    generate(request: GenerateRequest): Promise<GenerateResponse>;

    /**
     * 生成（流式）
     *
     * @param request - 统一请求
     * @yields 流式事件
     */
    generateStream(request: GenerateRequest): AsyncGenerator<StreamEvent>;

    /**
     * 计算 token 数
     *
     * @param messages - 消息列表
     * @returns token 数量
     */
    countTokens(messages: Message[]): Promise<number>;
}