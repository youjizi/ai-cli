# Gemini CLI Core 核心实现分析

> 本文档记录 gemini-cli/packages/core 的关键实现细节，作为 ai-cli-project 重构的参考。

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         应用层                                   │
│  AgentExecutor → Turn → GeminiChat → ContentGenerator           │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         核心层                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ GeminiChat  │  │    Turn     │  │  CoreToolScheduler      │ │
│  │ - history   │  │ - 流式处理  │  │  - 工具调度/确认/执行   │ │
│  │ - 对话管理  │  │ - 事件产出  │  │  - 结果收集             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         基础层                                   │
│  ┌───────────────────┐  ┌─────────────────────────────────────┐ │
│  │ ContentGenerator  │  │  工具类                              │ │
│  │ - generateContent │  │  - retry.ts (重试逻辑)              │ │
│  │ - stream          │  │  - errors.ts (错误处理)             │ │
│  │ - countTokens     │  │  - partUtils.ts (Part处理)          │ │
│  └───────────────────┘  └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         SDK 层                                   │
│                      @google/genai                               │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 核心类型 (来自 @google/genai)

### 2.1 消息类型

```typescript
// Content - 对话消息
interface Content {
  role: 'user' | 'model';  // 注意：Gemini 用 'model' 而非 'assistant'
  parts?: Part[];
}

// Part - 内容块（多模态）
interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };  // base64 图片/音频
  fileData?: { mimeType: string; fileUri: string };
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
  thought?: boolean;  // Gemini 特有：思考过程
  thoughtSignature?: string;  // Gemini 特有：思考签名
}

// FunctionCall - 工具调用
interface FunctionCall {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
}

// FunctionResponse - 工具结果
interface FunctionResponse {
  id?: string;
  name: string;
  response: { output?: string; error?: string; content?: Part[] };
}
```

### 2.2 请求/响应类型

```typescript
// 生成请求
interface GenerateContentParameters {
  model: string;
  contents: ContentListUnion;
  config?: GenerateContentConfig;
}

interface GenerateContentConfig {
  systemInstruction?: string | Content;
  tools?: Tool[];
  toolConfig?: ToolConfig;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  thinkingConfig?: ThinkingConfig;
  responseMimeType?: string;
  responseJsonSchema?: object;
  abortSignal?: AbortSignal;
  // ... 更多配置
}

// 生成响应
interface GenerateContentResponse {
  candidates?: Candidate[];
  usageMetadata?: UsageMetadata;
  modelVersion?: string;
  responseId?: string;
  functionCalls?: FunctionCall[];  // 便捷访问器
}

interface Candidate {
  content?: Content;
  finishReason?: FinishReason;
  citationMetadata?: CitationMetadata;
}

// 完成原因
enum FinishReason {
  STOP = 'STOP',
  MAX_TOKENS = 'MAX_TOKENS',
  SAFETY = 'SAFETY',
  RECITATION = 'RECITATION',
  MALFORMED_FUNCTION_CALL = 'MALFORMED_FUNCTION_CALL',
  // ...
}
```

## 3. ContentGenerator 接口

**文件**: `core/contentGenerator.ts`

```typescript
interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;  // 用户等级（影响配额）
}
```

**关键实现细节**:
- `LoggingContentGenerator` 装饰器：包装原始生成器，添加日志和遥测
- 支持多种认证方式：OAuth、API Key、Vertex AI
- 流式响应是 `AsyncGenerator<GenerateContentResponse>`，每个 chunk 都是完整响应结构

## 4. GeminiChat 类

**文件**: `core/geminiChat.ts`

### 4.1 核心职责
- 维护对话历史 (`history: Content[]`)
- 发送消息并处理流式响应
- 处理重试逻辑（内容无效时）
- 记录对话（ChatRecordingService）

### 4.2 关键方法

```typescript
class GeminiChat {
  private history: Content[] = [];
  private systemInstruction: string = '';
  private tools: Tool[] = [];

  // 核心方法：发送消息并返回流式事件
  async sendMessageStream(
    modelConfigKey: ModelConfigKey,
    message: PartListUnion,
    prompt_id: string,
    signal: AbortSignal,
  ): Promise<AsyncGenerator<StreamEvent>>

  // 历史管理
  getHistory(curated: boolean = false): Content[]
  addHistory(content: Content): void
  clearHistory(): void
  setHistory(history: Content[]): void

  // 工具管理
  setTools(tools: Tool[]): void
}
```

### 4.3 流式事件类型

```typescript
enum StreamEventType {
  CHUNK = 'chunk',   // 正常内容块
  RETRY = 'retry',   // 重试信号（UI 应丢弃之前的部分内容）
}

type StreamEvent =
  | { type: StreamEventType.CHUNK; value: GenerateContentResponse }
  | { type: StreamEventType.RETRY };
```

### 4.4 关键实现细节

**历史管理**:
```typescript
// 提取有效历史（过滤无效的模型输出）
function extractCuratedHistory(comprehensiveHistory: Content[]): Content[] {
  // 遍历历史，跳过无效的模型响应
  // 无效 = 空 parts 或 空文本
}

// 验证响应有效性
function isValidResponse(response: GenerateContentResponse): boolean {
  // 检查 candidates 存在且有内容
  // 检查 parts 非空
  // 检查文本非空（除非是 thought）
}
```

**重试逻辑**:
```typescript
// 内容无效时重试配置
const INVALID_CONTENT_RETRY_OPTIONS = {
  maxAttempts: 2,      // 1 初始 + 1 重试
  initialDelayMs: 500,
};

// 重试时设置 temperature = 1 鼓励不同输出
if (attempt > 0) {
  generateContentConfig.temperature = 1;
}
```

**Thought 签名处理** (Gemini 特有):
```typescript
// Preview Model 要求 functionCall 有 thoughtSignature
ensureActiveLoopHasThoughtSignatures(requestContents: Content[]): Content[] {
  // 找到最后一个用户文本消息（非 functionResponse）
  // 确保之后的每个 model turn 的第一个 functionCall 有 thoughtSignature
}
```

## 5. Turn 类

**文件**: `core/turn.ts`

### 5.1 核心职责
- 处理单轮对话的流式响应
- 解析 functionCall 并产出工具调用请求
- 产出各种事件供上层处理

### 5.2 事件类型

```typescript
enum GeminiEventType {
  Content = 'content',              // 文本内容
  ToolCallRequest = 'tool_call_request',  // 工具调用请求
  ToolCallResponse = 'tool_call_response', // 工具调用响应
  ToolCallConfirmation = 'tool_call_confirmation', // 工具确认
  UserCancelled = 'user_cancelled', // 用户取消
  Error = 'error',                  // 错误
  Thought = 'thought',              // 思考过程
  Finished = 'finished',            // 完成
  Citation = 'citation',            // 引用
  Retry = 'retry',                  // 重试
  InvalidStream = 'invalid_stream', // 无效流
  // ...
}
```

### 5.3 关键数据结构

```typescript
// 工具调用请求
interface ToolCallRequestInfo {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  isClientInitiated: boolean;
  prompt_id: string;
}

// 工具调用响应
interface ToolCallResponseInfo {
  callId: string;
  responseParts: Part[];
  resultDisplay: ToolResultDisplay | undefined;
  error: Error | undefined;
  errorType: ToolErrorType | undefined;
  outputFile?: string;
  contentLength?: number;
}
```

### 5.4 核心流程

```typescript
async *run(
  modelConfigKey: ModelConfigKey,
  req: PartListUnion,
  signal: AbortSignal,
): AsyncGenerator<ServerGeminiStreamEvent> {
  const responseStream = await this.chat.sendMessageStream(...);

  for await (const streamEvent of responseStream) {
    // 1. 处理取消
    if (signal?.aborted) {
      yield { type: GeminiEventType.UserCancelled };
      return;
    }

    // 2. 处理重试事件
    if (streamEvent.type === 'retry') {
      yield { type: GeminiEventType.Retry };
      continue;
    }

    // 3. 处理 thought（思考过程）
    const thoughtPart = resp.candidates?.[0]?.content?.parts?.[0];
    if (thoughtPart?.thought) {
      yield { type: GeminiEventType.Thought, value: parseThought(...) };
      continue;
    }

    // 4. 处理文本内容
    const text = getResponseText(resp);
    if (text) {
      yield { type: GeminiEventType.Content, value: text, traceId };
    }

    // 5. 处理 functionCall
    for (const fnCall of resp.functionCalls ?? []) {
      yield { type: GeminiEventType.ToolCallRequest, value: ... };
    }

    // 6. 处理完成
    if (finishReason) {
      yield { type: GeminiEventType.Finished, value: { reason, usageMetadata } };
    }
  }
}
```

## 6. CoreToolScheduler 类

**文件**: `core/coreToolScheduler.ts`

### 6.1 核心职责
- 调度工具执行
- 处理工具确认流程
- 收集工具执行结果
- 转换结果为 FunctionResponse

### 6.2 工具调用状态

```typescript
type Status = 
  | 'validating'      // 验证参数中
  | 'scheduled'       // 已调度，等待执行
  | 'executing'       // 执行中
  | 'awaiting_approval' // 等待用户确认
  | 'success'         // 成功
  | 'error'           // 错误
  | 'cancelled';      // 已取消

type ToolCall =
  | ValidatingToolCall
  | ScheduledToolCall
  | ExecutingToolCall
  | WaitingToolCall
  | SuccessfulToolCall
  | ErroredToolCall
  | CancelledToolCall;
```

### 6.3 关键方法

```typescript
// 转换工具结果为 FunctionResponse Part
function convertToFunctionResponse(
  toolName: string,
  callId: string,
  llmContent: PartListUnion,
): Part[] {
  // 处理字符串结果
  if (typeof contentToProcess === 'string') {
    return [createFunctionResponsePart(callId, toolName, contentToProcess)];
  }

  // 处理数组结果
  if (Array.isArray(contentToProcess)) {
    const functionResponse = createFunctionResponsePart(callId, toolName, 'Tool execution succeeded.');
    return [functionResponse, ...toParts(contentToProcess)];
  }

  // 处理二进制数据
  if (contentToProcess.inlineData || contentToProcess.fileData) {
    const functionResponse = createFunctionResponsePart(callId, toolName, `Binary content of type ${mimeType} was processed.`);
    return [functionResponse, contentToProcess];
  }

  // ...
}

// 创建 FunctionResponse Part
function createFunctionResponsePart(callId: string, toolName: string, output: string): Part {
  return {
    functionResponse: {
      id: callId,
      name: toolName,
      response: { output },
    },
  };
}
```

## 7. 重试机制

**文件**: `utils/retry.ts`

### 7.1 核心函数

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T>
```

### 7.2 配置选项

```typescript
interface RetryOptions {
  maxAttempts: number;        // 默认 3
  initialDelayMs: number;     // 默认 5000
  maxDelayMs: number;         // 默认 30000
  shouldRetryOnError: (error: Error) => boolean;
  shouldRetryOnContent?: (content: GenerateContentResponse) => boolean;
  onPersistent429?: (authType?: string, error?: unknown) => Promise<string | boolean | null>;
  signal?: AbortSignal;
}
```

### 7.3 重试条件

```typescript
function defaultShouldRetry(error: Error): boolean {
  // 429 Too Many Requests - 重试
  // 5xx Server Error - 重试
  // 400 Bad Request - 不重试
  if (error.status === 400) return false;
  return error.status === 429 || (error.status >= 500 && error.status < 600);
}
```

### 7.4 退避策略

```typescript
// 指数退避 + 抖动
const jitter = currentDelay * 0.3 * (Math.random() * 2 - 1);
const delayWithJitter = Math.max(0, currentDelay + jitter);
await delay(delayWithJitter, signal);
currentDelay = Math.min(maxDelayMs, currentDelay * 2);
```

## 8. 错误处理

**文件**: `utils/errors.ts`

### 8.1 错误类型层次

```typescript
// 致命错误（导致程序退出）
class FatalError extends Error {
  constructor(message: string, readonly exitCode: number)
}

class FatalAuthenticationError extends FatalError { exitCode = 41 }
class FatalInputError extends FatalError { exitCode = 42 }
class FatalConfigError extends FatalError { exitCode = 52 }
class FatalCancellationError extends FatalError { exitCode = 130 }

// HTTP 错误
class ForbiddenError extends Error {}      // 403
class UnauthorizedError extends Error {}   // 401
class BadRequestError extends Error {}     // 400

// 取消错误
class CanceledError extends Error {}
```

### 8.2 错误转换

```typescript
function toFriendlyError(error: unknown): unknown {
  // 从 Gaxios 响应中提取错误信息
  // 根据 HTTP 状态码返回对应的错误类型
  switch (data.error.code) {
    case 400: return new BadRequestError(message);
    case 401: return new UnauthorizedError(message);
    case 403: return new ForbiddenError(message);
  }
}
```

## 9. Part 工具函数

**文件**: `utils/partUtils.ts`

```typescript
// Part 转字符串
function partToString(value: PartListUnion, options?: { verbose?: boolean }): string

// 从响应中提取文本
function getResponseText(response: GenerateContentResponse): string | null {
  return response.candidates?.[0]?.content?.parts
    ?.filter(part => part.text)
    .map(part => part.text)
    .join('');
}

// 异步映射文本 Part
async function flatMapTextParts(
  parts: PartListUnion,
  transform: (text: string) => Promise<PartUnion[]>,
): Promise<PartUnion[]>

// 追加文本到最后一个 Part
function appendToLastTextPart(
  prompt: PartUnion[],
  textToAppend: string,
  separator = '\n\n',
): PartUnion[]
```

## 10. 类型转换

**文件**: `code_assist/converter.ts`

```typescript
// ContentListUnion -> Content[]
function toContents(contents: ContentListUnion): Content[]

// ContentUnion -> Content
function toContent(content: ContentUnion): Content

// PartUnion[] -> Part[]
function toParts(parts: PartUnion[]): Part[]

// PartUnion -> Part
function toPart(part: PartUnion): Part {
  // 处理字符串
  if (typeof part === 'string') {
    return { text: part };
  }

  // 处理 thought（特殊处理）
  if ('thought' in part && part.thought) {
    // 转换为文本或剥离 thought 属性
  }

  return part;
}
```

## 11. 实现优先级建议

### Phase 1: 基础层（最底层）
1. **统一类型定义** - 定义厂商无关的消息、内容、工具类型
2. **错误类型** - 统一错误处理
3. **工具函数** - retry、partUtils 等

### Phase 2: 适配器层
4. **LLMProviderAdapter 接口** - 定义适配器契约
5. **GeminiAdapter** - 实现 Gemini 适配器（保持兼容）

### Phase 3: 对话层
6. **UnifiedChat** - 统一对话管理（基于 GeminiChat）
7. **UnifiedTurn** - 统一轮次处理（基于 Turn）

### Phase 4: 工具层
8. **UnifiedToolScheduler** - 统一工具调度（基于 CoreToolScheduler）

### Phase 5: 扩展
9. **OpenAIAdapter** - OpenAI 适配器
10. **AnthropicAdapter** - Anthropic 适配器

---

*文档版本: 1.0*
*最后更新: 2025-12-20*
