import type {
    Content,
    Part,
    Tool,
    FunctionDeclaration,
    GenerateContentResponse,
} from '@google/genai';

import type {
    Message,
    ContentPart,
    // TextPart,
    // ImagePart,
    // ToolCallPart,
    // ToolResultPart,
    ToolDefinition,
    GenerateResponse,
    FinishReason,
} from '../../types.js';

/**
 * 统一角色 → Gemini 角色
 *
 * 映射关系：
 * - user → user
 * - assistant → model（Gemini 特有）
 * - tool → user（工具结果作为 user 消息）
 * - system → 不在这里处理，用 systemInstruction
 */
function toGeminiRole(role: string): 'user' | 'model' {
    if (role === 'assistant') return 'model';
    return 'user';
}

/**
 * 统一内容部分 → Gemini Part
 */
function toGeminiPart(part: ContentPart): Part {
    switch (part.type) {
        case 'text':
            return {text: part.text};
        case 'image':
            if (part.data) {
                return {
                    inlineData: {
                        mimeType: part.mimeType,
                        data: part.data,
                    },
                };
            }
            // URL 方式需要 Gemini 支持
            throw new Error('Image URL not supported yet');
        case 'toolCall':
            return {
                functionCall: {
                    name: part.name,
                    args: JSON.parse(part.arguments),  // 字符串 → 对象
                },
            };
        case 'toolResult':
            return {
                functionResponse: {
                    name: part.toolCallId,  // Gemini 用 name 匹配
                    response: {result: part.content},
                },
            };
    }
}

/**
 * 统一消息列表 → Gemini Content 列表
 */
export function toGeminiContents(messages: Message[]): Content[] {
    return messages
        .filter(m => m.role !== 'system')  // system 单独处理
        .map(message => ({
            role: toGeminiRole(message.role),
            parts: message.content.map(toGeminiPart),
        }));
}

/**
 * 统一工具定义 → Gemini Tool
 */
export function toGeminiTools(tools: ToolDefinition[]): Tool[] {
    const declarations: FunctionDeclaration[] = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as any,
    }));

    return [{ functionDeclarations: declarations }];
}


/**
 * Gemini Part → 统一内容部分
 */
function fromGeminiPart(part: Part): ContentPart | null {
    if ('text' in part && part.text) {
        return { type: 'text', text: part.text };
    }

    if ('functionCall' in part && part.functionCall) {
        return {
            type: 'toolCall',
            id: part.functionCall.name || '',  // Gemini 没有单独的 id
            name: part.functionCall.name || '',
            arguments: JSON.stringify(part.functionCall.args),  // 对象 → 字符串
        };
    }

    // 其他类型暂不处理
    return null;
}

/**
 * Gemini FinishReason → 统一 FinishReason
 */
function fromGeminiFinishReason(
    reason: string | undefined,
    hasToolCalls: boolean
): FinishReason {
    if (hasToolCalls) return 'tool_calls';

    switch (reason) {
        case 'STOP': return 'stop';
        case 'MAX_TOKENS': return 'length';
        case 'SAFETY': return 'content_filter';
        default: return 'stop';
    }
}

/**
 * Gemini 响应 → 统一响应
 */
export function fromGeminiResponse(
    response: GenerateContentResponse
): GenerateResponse {
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    // 转换所有 parts
    const content: ContentPart[] = parts
        .map(fromGeminiPart)
        .filter((p): p is ContentPart => p !== null);

    // 检查是否有工具调用
    const hasToolCalls = content.some(p => p.type === 'toolCall');

    return {
        message: {
            role: 'assistant',
            content,
        },
        finishReason: fromGeminiFinishReason(
            candidate?.finishReason,
            hasToolCalls
        ),
        usage: response.usageMetadata ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
        } : undefined,
    };
}

