# 核心数据结构和流程代表快速参考

## 关键类和成员变量

### GeminiClient - 核心对话客户端

```typescript
export class GeminiClient {
  // ============ 核心对话组件 ============
  private chat?: GeminiChat;              // [FLOW-4] 聊天会话
  private contentGenerator?: ContentGenerator; // [FLOW-4] 内容生成器

  // ============ 模型配置 ============
  private readonly embeddingModel: string;    // 嵌入模型名称
  private readonly generateContentConfig: GenerateContentConfig; // API 配置

  // ============ 会话状态追踪 ============
  private sessionTurnCount = 0;           // 当前会话轮次计数
  private readonly loopDetector: LoopDetectionService; // 循环检测
  private lastPromptId: string;           // 最后的提示 ID

  // ============ IDE 上下文管理 ============
  private lastSentIdeContext: IdeContext | undefined; // [FLOW-3] 上次发送的上下文
  private forceFullIdeContext = true;     // [FLOW-3] 是否强制全量上下文

  // ============ 压缩状态 ============
  private hasFailedCompressionAttempt = false; // [FLOW-2] 压缩失败标志
}
```

**关键方法**:
- `sendMessageStream()` - [FLOW-1] 主对话入口
- `tryCompressChat()` - [FLOW-2] 历史压缩
- `getIdeContextParts()` - [FLOW-3] IDE 上下文管理

---

### GeminiChat - 聊天会话管理

```typescript
export class GeminiChat {
  // ============ 并发控制 ============
  private sendPromise: Promise<void> = Promise.resolve(); // [FLOW-4] 消息发送承诺

  // ============ 配置和生成器 ============
  private readonly config: Config;                    // 全局配置
  private readonly contentGenerator: ContentGenerator; // [FLOW-4] 内容生成器
  private readonly generationConfig: GenerateContentConfig; // API 配置

  // ============ 对话历史 ============
  private history: Content[] = [];        // [FLOW-6] 完整历史
  // 包含所有用户和模型消息，包括无效的
  // 结构: [user, model, user, model, ...]
}
```

**关键方法**:
- `sendMessageStream()` - [FLOW-4] 流式发送消息
- `processStreamResponse()` - [FLOW-5] 处理流响应
- `recordHistory()` - [FLOW-6] 记录历史

**历史类型**:
- **完整历史** (comprehensive): 包含所有响应，包括无效的
- **策划历史** (curated): 仅包含有效的轮次，用于后续 API 调用

---

### Turn - 单轮对话管理

```typescript
export class Turn {
  // ============ 工具调用管理 ============
  readonly pendingToolCalls: ToolCallRequestInfo[] = []; // [FLOW-8] 待处理工具调用

  // ============ 调试和元数据 ============
  private debugResponses: GenerateContentResponse[] = []; // 调试用的 API 响应
  private pendingCitations = new Set<string>();          // [FLOW-7] 待处理引用
  finishReason: FinishReason | undefined = undefined;    // [FLOW-7] 完成原因

  // ============ 对话上下文 ============
  private readonly chat: GeminiChat;      // [FLOW-7] 聊天会话
  private readonly prompt_id: string;     // [FLOW-7] 提示 ID
}
```

**关键方法**:
- `run()` - [FLOW-7] 单轮对话执行
- `handlePendingFunctionCall()` - [FLOW-8] 工具调用处理

---

## 关键数据结构

### Content - 聊天历史条目

```typescript
interface Content {
  role: 'user' | 'model';  // 发言者角色
  parts: Part[];           // 内容部分列表
}
```

**用途**: 表示一条用户或模型的消息

---

### Part - 内容部分

```typescript
interface Part {
  text?: string;                    // 文本内容
  thought?: string;                 // 思考内容（仅模型）
  functionCall?: FunctionCall;      // 工具调用请求
  functionResponse?: FunctionResponse; // 工具调用响应
  inlineData?: InlineData;          // 内联数据（图片等）
  fileData?: FileData;              // 文件数据
}
```

**用途**: 表示消息中的一个内容片段

---

### [FLOW-8] ToolCallRequestInfo - 工具调用请求

```typescript
interface ToolCallRequestInfo {
  callId: string;                    // 唯一的调用 ID
  name: string;                      // 工具名称
  args: Record<string, unknown>;     // 工具参数
  isClientInitiated: boolean;        // 是否由客户端发起（通常为 false）
  prompt_id: string;                 // 提示 ID
}
```

**用途**: 传递模型请求的工具调用信息

**示例**:
```json
{
  "callId": "read-file-1234567890-abc123",
  "name": "readFile",
  "args": {
    "path": "src/main.ts",
    "explanation": "查看主文件"
  },
  "isClientInitiated": false,
  "prompt_id": "session-123"
}
```

---

### ToolCallResponseInfo - 工具调用响应

```typescript
interface ToolCallResponseInfo {
  callId: string;                    // 对应的调用 ID
  responseParts: Part[];             // 工具返回的内容部分
  resultDisplay: ToolResultDisplay | undefined; // 显示方式
  error: Error | undefined;          // 执行错误
  errorType: ToolErrorType | undefined; // 错误类型
}
```

**用途**: 传递工具执行的结果

---

### [FLOW-7] ThoughtSummary - 思考总结

```typescript
type ThoughtSummary = {
  subject: string;      // 思考的主题（从 **Subject** 提取）
  description: string;  // 思考的描述
}
```

**用途**: 向用户展示模型的推理过程

**示例**:
```json
{
  "subject": "分析用户需求",
  "description": "用户要求查看核心包的结构。我需要列出 packages/core 目录下的所有文件和子目录。"
}
```

---

### [FLOW-2] ChatCompressionInfo - 压缩信息

```typescript
interface ChatCompressionInfo {
  originalTokenCount: number;        // 压缩前的 token 数
  newTokenCount: number;             // 压缩后的 token 数
  compressionStatus: CompressionStatus; // 压缩状态
}
```

**用途**: 记录聊天历史压缩的结果

**示例**:
```json
{
  "originalTokenCount": 45000,
  "newTokenCount": 28000,
  "compressionStatus": 1  // COMPRESSED
}
```

---

## 关键枚举

### [FLOW-7] GeminiEventType - 事件类型

```typescript
enum GeminiEventType {
  Content = 'content',                    // [FLOW-7] 文本内容
  ToolCallRequest = 'tool_call_request',  // [FLOW-8] 工具调用请求
  ToolCallResponse = 'tool_call_response', // 工具调用响应
  ToolCallConfirmation = 'tool_call_confirmation', // 工具调用确认
  UserCancelled = 'user_cancelled',       // 用户取消
  Error = 'error',                        // [FLOW-7] 错误
  ChatCompressed = 'chat_compressed',     // [FLOW-2] 聊天压缩
  Thought = 'thought',                    // [FLOW-7] 思考
  MaxSessionTurns = 'max_session_turns',  // [FLOW-1] 最大轮次
  Finished = 'finished',                  // [FLOW-7] 完成
  LoopDetected = 'loop_detected',         // [FLOW-1] 循环检测
  Citation = 'citation',                  // [FLOW-7] 引用
}
```

**用途**: 标识事件流中每个事件的类型

---

### [FLOW-2] CompressionStatus - 压缩状态

```typescript
enum CompressionStatus {
  COMPRESSED = 1,                         // 压缩成功
  COMPRESSION_FAILED_INFLATED_TOKEN_COUNT, // 压缩失败：token 数增加
  COMPRESSION_FAILED_TOKEN_COUNT_ERROR,   // 压缩失败：token 计数错误
  NOOP,                                   // 无操作：无需压缩
}
```

**用途**: 表示压缩操作的最终状态

---

## 事件流类型

### ServerGeminiStreamEvent - 事件流联合类型

```typescript
type ServerGeminiStreamEvent =
  | ServerGeminiChatCompressedEvent      // [FLOW-2] 聊天压缩
  | ServerGeminiCitationEvent            // [FLOW-7] 引用
  | ServerGeminiContentEvent             // [FLOW-7] 文本内容
  | ServerGeminiErrorEvent               // [FLOW-7] 错误
  | ServerGeminiFinishedEvent            // [FLOW-7] 完成
  | ServerGeminiLoopDetectedEvent        // [FLOW-1] 循环检测
  | ServerGeminiMaxSessionTurnsEvent     // [FLOW-1] 最大轮次
  | ServerGeminiThoughtEvent             // [FLOW-7] 思考
  | ServerGeminiToolCallConfirmationEvent // 工具调用确认
  | ServerGeminiToolCallRequestEvent     // [FLOW-8] 工具调用请求
  | ServerGeminiToolCallResponseEvent    // 工具调用响应
  | ServerGeminiUserCancelledEvent;      // 用户取消
```

**用途**: 表示对话流中可能发生的所有事件

---

## 关键常量

### 会话配置

```typescript
const MAX_TURNS = 100;  // [FLOW-1] 最大轮次数
```

### 压缩配置

```typescript
const COMPRESSION_TOKEN_THRESHOLD = 0.7;      // [FLOW-2] 触发压缩的 token 百分比
const COMPRESSION_PRESERVE_THRESHOLD = 0.3;   // [FLOW-2] 保留的历史百分比
```

### 重试配置

```typescript
const INVALID_CONTENT_RETRY_OPTIONS = {
  maxAttempts: 3,        // [FLOW-4] 最多重试 3 次
  initialDelayMs: 500,   // [FLOW-4] 初始延迟 500ms
};
```

---

## 数据流示例

### 典型的对话流程

```
用户输入: "查看 src/main.ts"
   ↓
[FLOW-1] GeminiClient.sendMessageStream()
   ├─ 检查会话轮次: sessionTurnCount = 1
   ├─ [FLOW-2] 尝试压缩: compressionStatus = NOOP
   ├─ [FLOW-3] 注入 IDE 上下文: forceFullIdeContext = false
   ├─ [FLOW-7] Turn.run()
   │   └─ [FLOW-4] GeminiChat.sendMessageStream()
   │       ├─ 创建用户内容: { role: 'user', parts: [...] }
   │       ├─ [FLOW-5] 处理流响应
   │       │   ├─ 收集文本: "我来帮你查看..."
   │       │   ├─ 检测工具调用: readFile
   │       │   └─ 生成事件: Content, ToolCallRequest
   │       └─ [FLOW-6] 记录历史
   │           └─ history = [user, model]
   └─ 生成事件流
       ├─ { type: Content, value: "我来帮你查看..." }
       ├─ { type: ToolCallRequest, value: { callId, name: 'readFile', args: {...} } }
       └─ { type: Finished, value: 'STOP' }
   ↓
事件流输出给上层处理
```

### 工具调用流程

```
模型生成工具调用
   ↓
[FLOW-8] Turn.handlePendingFunctionCall()
   ├─ 生成 callId: "readFile-1234567890-abc123"
   ├─ 创建 ToolCallRequestInfo
   ├─ 添加到 pendingToolCalls
   └─ 生成 ToolCallRequest 事件
   ↓
上层处理工具调用
   ├─ 执行工具
   ├─ 获取结果
   └─ 创建 ToolCallResponseInfo
   ↓
模型继续对话
```

### 压缩流程

```
历史 token 数 > 70% * limit
   ↓
[FLOW-2] GeminiClient.tryCompressChat()
   ├─ 计算原始 token 数: 45000
   ├─ 找到压缩分割点 (保留最后 30%)
   ├─ 发送压缩提示词给模型
   ├─ 创建新 chat 会话
   ├─ 计算新 token 数: 28000
   └─ 返回 ChatCompressionInfo
       ├─ originalTokenCount: 45000
       ├─ newTokenCount: 28000
       └─ compressionStatus: COMPRESSED
   ↓
生成 ChatCompressed 事件
```

---

## 快速查找

| 概念 | 类型 | 文件 | 说明 |
|------|------|------|------|
| GeminiClient | 类 | client.ts | 主对话客户端 |
| GeminiChat | 类 | geminiChat.ts | 聊天会话管理 |
| Turn | 类 | turn.ts | 单轮对话管理 |
| Content | 接口 | @google/genai | 聊天历史条目 |
| Part | 接口 | @google/genai | 内容部分 |
| ToolCallRequestInfo | 接口 | turn.ts | 工具调用请求 |
| ToolCallResponseInfo | 接口 | turn.ts | 工具调用响应 |
| ThoughtSummary | 类型 | turn.ts | 思考总结 |
| ChatCompressionInfo | 接口 | turn.ts | 压缩信息 |
| GeminiEventType | 枚举 | turn.ts | 事件类型 |
| CompressionStatus | 枚举 | turn.ts | 压缩状态 |
| ServerGeminiStreamEvent | 类型 | turn.ts | 事件流联合类型 |

---

## 使用建议

1. **理解数据流**: 从 Content 和 Part 开始，理解消息的结构
2. **追踪工具调用**: 关注 ToolCallRequestInfo 和 ToolCallResponseInfo 的流转
3. **监控压缩**: 观察 ChatCompressionInfo 的变化
4. **处理事件**: 根据 GeminiEventType 处理不同的事件
5. **调试**: 使用 Turn.debugResponses 查看原始 API 响应

