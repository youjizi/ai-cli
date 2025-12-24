/**
 * 消息角色
 *
 * - user: 用户输入，所有厂商都支持
 * - assistant: 模型输出，OpenAI/Anthropic 用 assistant，Gemini 用 model
 * - system: 系统指令，部分厂商作为独立参数
 * - tool: 工具结果，返回给模型的工具执行结果
 */
export type Role = 'user' | 'assistant' | 'system' | 'tool';




export interface TextPart {
    /** 文本类型 */
    type: 'text';
    /** 文本内容 */
    text: string;
}

/**
 * 图片内容
 *
 * 支持两种方式：
 * - data: base64 编码的图片数据
 * - url: 图片 URL（部分厂商支持）
 */
export interface ImagePart {
    type: 'image';
    mimeType: string;
    data?: string;   // base64
    url?: string;    // URL
}

/**
 * 工具调用（模型请求调用工具）
 *
 * 关键设计决策：
 * - arguments 是 JSON 字符串，不是对象！
 * - 原因：OpenAI 原生就是字符串，统一后避免序列化问题
 * - 使用时：JSON.parse(part.arguments) 获取对象
 */
export interface ToolCallPart {
    type: 'toolCall';
    id: string;           // 调用 ID，用于匹配结果
    name: string;         // 工具名称
    arguments: string;    // JSON 字符串！
}

/**
 * 工具结果（工具执行结果返回给模型）
 *
 * 关键设计决策：
 * - content 是纯字符串，不是数组！
 * - 原因：所有厂商都支持字符串，这是最大公约数
 * - 如果需要返回复杂数据，JSON.stringify 后放入 content
 */
export interface ToolResultPart {
    type: 'toolResult';
    toolCallId: string;   // 对应的调用 ID
    content: string;      // 结果内容（字符串）
    isError?: boolean;    // 是否为错误结果
}

/**
    内容体
 */
export type ContentPart = TextPart | ImagePart | ToolCallPart | ToolResultPart;



/**
 * 统一消息类型
 *
 * 这是整个系统的核心数据结构！
 * 所有对话历史、请求、响应都基于此
 */
export interface Message {
    role: Role;
    content: ContentPart[];
}

/**
 * 工具定义
 *
 * 用于告诉模型有哪些工具可用
 * parameters 使用 JSON Schema 格式
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: object;  // JSON Schema
}

/**
 * 工具选择模式
 *
 * - auto: 模型自动决定是否调用工具
 * - none: 禁用工具调用
 * - required: 必须调用工具
 * - { name: string }: 指定调用某个工具
 */
export type ToolChoice = 'auto' | 'none' | 'required' | { name: string };


/**
 * 生成请求
 *
 * 这是调用 LLM 的统一入口参数
 *
 * 设计要点：
 * - system 是独立字段，不在 messages 中
 * - 原因：Gemini 和 Anthropic 都用独立参数
 */
export interface GenerateRequest {
    /** 模型名称，如 'gemini-2.0-flash' */
    model: string;

    /** 消息历史 */
    messages: Message[];

    /** 系统指令（独立字段） */
    system?: string;

    /** 可用工具 */
    tools?: ToolDefinition[];

    /** 工具选择模式 */
    toolChoice?: ToolChoice;

    /** 温度 (0-2)，越高越随机 */
    temperature?: number;

    /** 最大输出 token */
    maxTokens?: number;

    /** Top-P 采样 */
    topP?: number;

    /** 停止序列 */
    stopSequences?: string[];

    /** 取消信号，用于中断请求 */
    signal?: AbortSignal;
}


/**
 * 完成原因
 */
export type FinishReason =
    | 'stop'           // 正常完成
    | 'length'         // 达到 maxTokens
    | 'tool_calls'     // 需要调用工具
    | 'content_filter' // 内容被过滤
    | 'error';         // 发生错误


/**
 * Token 使用量
 */
export interface Usage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

/**
 * 生成响应
 */
export interface GenerateResponse {
    /** 响应消息 */
    message: Message;

    /** 完成原因 */
    finishReason: FinishReason;

    /** Token 使用量 */
    usage?: Usage;
}