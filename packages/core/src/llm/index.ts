export type {
    Role,
    TextPart,
    ImagePart,
    ToolCallPart,
    ToolResultPart,
    ContentPart,
    Message,
    ToolDefinition,
    ToolChoice,
    GenerateRequest,
    GenerateResponse,
    FinishReason,
    Usage,
} from './types.js';

export type {
    TextDeltaEvent,
    ToolCallEvent,
    DoneEvent,
    StreamEvent,
} from './stream.js';

export type {
    LLMAdapter,
    AdapterCapabilities,
} from './adapter.js';

// 类导出
export { ProviderRegistry, registry } from './registry.js';
export { AdapterError, ProviderNotFoundError } from './errors.js';

// 适配器导出
export { GeminiAdapter } from './adapters/gemini/index.js';