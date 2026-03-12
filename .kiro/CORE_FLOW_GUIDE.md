# 🚀 核心对话流程完全指南 (1小时速成)

> 点击链接可直接跳转到代码位置

---

## 📋 目录

1. [整体架构图](#整体架构图)
2. [STEP 1: 主入口 sendMessageStream](#step-1-主入口)
3. [STEP 2: 历史压缩 tryCompressChat](#step-2-历史压缩)
4. [STEP 3: IDE上下文 getIdeContextParts](#step-3-ide上下文)
5. [STEP 4: 流式发送 sendMessageStream](#step-4-流式发送)
6. [STEP 5: 流响应处理 processStreamResponse](#step-5-流响应处理)
7. [STEP 6: 历史记录 recordHistory](#step-6-历史记录)
8. [STEP 7: 单轮执行 Turn.run](#step-7-单轮执行)
9. [STEP 8: 工具调用 handlePendingFunctionCall](#step-8-工具调用)
10. [关键变量速查表](#关键变量速查表)

---

## 整体架构图

```
用户输入 "帮我看看 src/main.ts"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  GeminiClient.sendMessageStream()  ← 主入口 [STEP 1]        │
│  📁 client.ts:476                                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 检查轮次限制 (sessionTurnCount vs MAX_TURNS=100) │   │
│  │ 2. 压缩历史 → tryCompressChat() [STEP 2]            │   │
│  │ 3. 注入IDE上下文 → getIdeContextParts() [STEP 3]    │   │
│  │ 4. 循环检测 → loopDetector.turnStarted()            │   │
│  │ 5. 创建Turn并执行 → Turn.run() [STEP 7]             │   │
│  │ 6. 检查下一发言人 → checkNextSpeaker()              │   │
│  │ 7. 递归继续对话（如需要）                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Turn.run()  ← 单轮执行 [STEP 7]                            │
│  📁 turn.ts:295                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 调用 GeminiChat.sendMessageStream() [STEP 4]      │   │
│  │ 2. 遍历响应流，生成事件:                              │   │
│  │    - Thought 事件 (思考过程)                          │   │
│  │    - Content 事件 (文本内容)                          │   │
│  │    - ToolCallRequest 事件 (工具调用) [STEP 8]        │   │
│  │    - Citation 事件 (引用)                             │   │
│  │    - Finished 事件 (完成)                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  GeminiChat.sendMessageStream()  ← 流式发送 [STEP 4]        │
│  📁 geminiChat.ts:340                                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 等待前一消息完成 (sendPromise)                    │   │
│  │ 2. 创建用户内容 → createUserContent()               │   │
│  │ 3. 添加到历史 → history.push(userContent)           │   │
│  │ 4. 调用API → makeApiCallAndProcessStream()          │   │
│  │ 5. 处理流 → processStreamResponse() [STEP 5]        │   │
│  │ 6. 记录历史 → recordHistory() [STEP 6]              │   │
│  │ 7. 重试机制 (最多3次, 延迟500ms)                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
    事件流输出给上层
```

---

## STEP 1: 主入口

### 📁 文件位置
[packages/core/src/core/client.ts:476](packages/core/src/core/client.ts#L476)

### 🎯 方法签名
```typescript
async *sendMessageStream(
  request: PartListUnion,      // 用户输入 (文本/图片等)
  signal: AbortSignal,         // 取消信号
  prompt_id: string,           // 会话ID (用于循环检测)
  turns: number = 100,         // 剩余轮次
  originalModel?: string,      // 原始模型 (用于检测模型切换)
): AsyncGenerator<ServerGeminiStreamEvent, Turn>
```

### 📝 详细步骤


**第1步: 检查提示ID变化** (行 477-480)
```typescript
if (this.lastPromptId !== prompt_id) {
  this.loopDetector.reset(prompt_id);  // 重置循环检测器
  this.lastPromptId = prompt_id;
}
```
- `lastPromptId`: 上一次的会话ID
- 如果ID变了，说明是新会话，重置循环检测

**第2步: 检查轮次限制** (行 481-486)
```typescript
this.sessionTurnCount++;
if (this.config.getMaxSessionTurns() > 0 &&
    this.sessionTurnCount > this.config.getMaxSessionTurns()) {
  yield { type: GeminiEventType.MaxSessionTurns };
  return new Turn(this.getChat(), prompt_id);
}
```
- `sessionTurnCount`: 当前会话已执行的轮次
- `MAX_TURNS = 100`: 最大轮次限制
- 超过限制则生成 `MaxSessionTurns` 事件并返回

**第3步: 尝试压缩历史** (行 493-497) → [STEP 2](#step-2-历史压缩)
```typescript
const compressed = await this.tryCompressChat(prompt_id);
if (compressed.compressionStatus === CompressionStatus.COMPRESSED) {
  yield { type: GeminiEventType.ChatCompressed, value: compressed };
}
```

**第4步: 注入IDE上下文** (行 507-518) → [STEP 3](#step-3-ide上下文)
```typescript
if (this.config.getIdeMode() && !hasPendingToolCall) {
  const { contextParts, newIdeContext } = this.getIdeContextParts(
    this.forceFullIdeContext || history.length === 0,
  );
  if (contextParts.length > 0) {
    this.getChat().addHistory({
      role: 'user',
      parts: [{ text: contextParts.join('\n') }],
    });
  }
  this.lastSentIdeContext = newIdeContext;
  this.forceFullIdeContext = false;
}
```
- `forceFullIdeContext`: 是否强制发送完整上下文
- `lastSentIdeContext`: 上次发送的IDE上下文 (用于计算增量)

**第5步: 创建Turn并执行** (行 520-533) → [STEP 7](#step-7-单轮执行)
```typescript
const turn = new Turn(this.getChat(), prompt_id);
const loopDetected = await this.loopDetector.turnStarted(signal);
if (loopDetected) {
  yield { type: GeminiEventType.LoopDetected };
  return turn;
}
const resultStream = turn.run(request, signal);
for await (const event of resultStream) {
  if (this.loopDetector.addAndCheck(event)) {
    yield { type: GeminiEventType.LoopDetected };
    return turn;
  }
  yield event;
}
```

**第6步: 检查下一发言人** (行 543-561)
```typescript
if (!turn.pendingToolCalls.length && signal && !signal.aborted) {
  const nextSpeakerCheck = await checkNextSpeaker(this.getChat(), this, signal);
  if (nextSpeakerCheck?.next_speaker === 'model') {
    const nextRequest = [{ text: 'Please continue.' }];
    yield* this.sendMessageStream(nextRequest, signal, prompt_id, boundedTurns - 1, initialModel);
  }
}
```
- 如果没有待处理的工具调用，检查模型是否需要继续
- 如果需要，递归调用自己

---

## STEP 2: 历史压缩

### 📁 文件位置
[packages/core/src/core/client.ts:810](packages/core/src/core/client.ts#L810)

### 🎯 方法签名
```typescript
async tryCompressChat(
  prompt_id: string,
  force: boolean = false,
): Promise<ChatCompressionInfo>
```

### 📝 详细步骤


**第1步: 获取策划历史** (行 820)
```typescript
const curatedHistory = this.getChat().getHistory(true);
```
- `curated = true`: 只获取有效的历史 (过滤掉无效响应)
- 如果历史为空或之前压缩失败过，直接返回 NOOP

**第2步: 计算原始token数** (行 833-835)
```typescript
const { totalTokens: originalTokenCount } =
  await this.getContentGenerator().countTokens({
    model,
    contents: curatedHistory,
  });
```

**第3步: 检查是否需要压缩** (行 847-855)
```typescript
const threshold = contextPercentageThreshold ?? COMPRESSION_TOKEN_THRESHOLD; // 0.7
if (originalTokenCount < threshold * tokenLimit(model)) {
  return { compressionStatus: CompressionStatus.NOOP };
}
```
- `COMPRESSION_TOKEN_THRESHOLD = 0.7`: 当token数超过模型限制的70%时触发压缩

**第4步: 找到压缩分割点** (行 857-867)
```typescript
let compressBeforeIndex = findIndexAfterFraction(
  curatedHistory,
  1 - COMPRESSION_PRESERVE_THRESHOLD,  // 1 - 0.3 = 0.7
);
```
- `COMPRESSION_PRESERVE_THRESHOLD = 0.3`: 保留最后30%的历史
- 找到前70%历史的结束位置

**第5步: 发送压缩提示词** (行 872-882)
```typescript
const historyToCompress = curatedHistory.slice(0, compressBeforeIndex);
const historyToKeep = curatedHistory.slice(compressBeforeIndex);
this.getChat().setHistory(historyToCompress);
const { text: summary } = await this.getChat().sendMessage({
  message: { text: 'First, reason in your scratchpad. Then, generate the <state_snapshot>.' },
  config: { systemInstruction: { text: getCompressionPrompt() } },
}, prompt_id);
```
- 让模型总结前70%的历史

**第6步: 创建新会话** (行 883-893)
```typescript
const chat = await this.startChat([
  { role: 'user', parts: [{ text: summary }] },
  { role: 'model', parts: [{ text: 'Got it. Thanks for the additional context!' }] },
  ...historyToKeep,
]);
```
- 用总结 + 保留的30%历史创建新会话

**第7步: 验证压缩效果** (行 895-915)
```typescript
const { totalTokens: newTokenCount } = await this.getContentGenerator().countTokens({...});
if (newTokenCount > originalTokenCount) {
  // 压缩失败，回滚
  this.getChat().setHistory(curatedHistory);
  return { compressionStatus: CompressionStatus.COMPRESSION_FAILED_INFLATED_TOKEN_COUNT };
} else {
  this.chat = chat;  // 压缩成功，使用新会话
}
```

### 📊 返回值
```typescript
interface ChatCompressionInfo {
  originalTokenCount: number;  // 压缩前token数
  newTokenCount: number;       // 压缩后token数
  compressionStatus: CompressionStatus;  // COMPRESSED | NOOP | FAILED_*
}
```

---

## STEP 3: IDE上下文

### 📁 文件位置
[packages/core/src/core/client.ts:296](packages/core/src/core/client.ts#L296)

### 🎯 方法签名
```typescript
private getIdeContextParts(forceFullContext: boolean): {
  contextParts: string[];
  newIdeContext: IdeContext | undefined;
}
```

### 📝 详细步骤

**第1步: 获取当前IDE上下文** (行 302)
```typescript
const currentIdeContext = ideContext.getIdeContext();
```

**第2步A: 全量模式** (行 306-340) - 当 `forceFullContext = true`
```typescript
const openFiles = currentIdeContext.workspaceState?.openFiles || [];
const activeFile = openFiles.find((f) => f.isActive);
const contextData = {
  activeFile: {
    path: activeFile.path,
    cursor: { line: ..., character: ... },
    selectedText: activeFile.selectedText,
  },
  otherOpenFiles: [...],
};
```
输出示例:
```json
{
  "activeFile": {
    "path": "src/main.ts",
    "cursor": { "line": 10, "character": 5 },
    "selectedText": "function hello()"
  },
  "otherOpenFiles": ["src/utils.ts", "package.json"]
}
```


**第2步B: 增量模式** (行 342-420) - 当 `forceFullContext = false`
```typescript
const changes = {};
// 检测新打开的文件
if (openedFiles.length > 0) changes['filesOpened'] = openedFiles;
// 检测关闭的文件
if (closedFiles.length > 0) changes['filesClosed'] = closedFiles;
// 检测活跃文件变化
if (activeFileChanged) changes['activeFileChanged'] = {...};
// 检测光标移动
if (cursorMoved) changes['cursorMoved'] = {...};
// 检测选中文本变化
if (selectionChanged) changes['selectionChanged'] = {...};
```
输出示例:
```json
{
  "changes": {
    "filesOpened": ["src/new.ts"],
    "cursorMoved": { "path": "src/main.ts", "cursor": { "line": 20, "character": 0 } }
  }
}
```

### 🔑 关键变量
| 变量 | 类型 | 说明 |
|------|------|------|
| `forceFullIdeContext` | boolean | 是否强制全量 (首次/重置后为true) |
| `lastSentIdeContext` | IdeContext | 上次发送的上下文 (用于计算增量) |

---

## STEP 4: 流式发送

### 📁 文件位置
[packages/core/src/core/geminiChat.ts:340](packages/core/src/core/geminiChat.ts#L340)

### 🎯 方法签名
```typescript
async sendMessageStream(
  params: SendMessageParameters,
  prompt_id: string,
): Promise<AsyncGenerator<GenerateContentResponse>>
```

### 📝 详细步骤

**第1步: 等待前一消息完成** (行 347)
```typescript
await this.sendPromise;
```
- `sendPromise`: 确保消息按顺序处理的Promise

**第2步: 创建用户内容** (行 354)
```typescript
const userContent = createUserContent(params.message);
```

**第3步: 添加到历史** (行 357)
```typescript
this.history.push(userContent);
const requestContents = this.getHistory(true);  // 获取策划历史
```
- 先添加用户消息到历史
- 获取策划历史用于API调用

**第4步: 重试循环** (行 362-405)
```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    const stream = await self.makeApiCallAndProcessStream(...);
    for await (const chunk of stream) {
      yield chunk;
    }
    break;  // 成功则退出
  } catch (error) {
    if (error instanceof EmptyStreamError && attempt < 2) {
      await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
      continue;  // 重试
    }
    break;
  }
}
```
- 最多重试3次
- 延迟: 500ms, 1000ms, 1500ms

**第5步: 调用API** (行 420-450) `makeApiCallAndProcessStream()`
```typescript
const streamResponse = await retryWithBackoff(apiCall, {
  shouldRetry: (error) => {
    if (error.message.includes('429')) return true;  // 配额错误
    if (error.message.match(/5\d{2}/)) return true;  // 服务器错误
    return false;
  },
  onPersistent429: async () => await this.handleFlashFallback(...),
});
return this.processStreamResponse(streamResponse, userContent);
```

---

## STEP 5: 流响应处理

### 📁 文件位置
[packages/core/src/core/geminiChat.ts:530](packages/core/src/core/geminiChat.ts#L530)

### 🎯 方法签名
```typescript
private async *processStreamResponse(
  streamResponse: AsyncGenerator<GenerateContentResponse>,
  userInput: Content,
): AsyncGenerator<GenerateContentResponse>
```

### 📝 详细步骤

**第1步: 初始化状态变量** (行 535-542)
```typescript
const modelResponseParts: Part[] = [];  // 收集所有响应部分
let hasReceivedAnyChunk = false;        // 是否收到任何chunk
let hasToolCall = false;                 // 是否有工具调用
let lastChunk = null;                    // 最后一个chunk
let isStreamInvalid = false;             // 流是否无效
```

**第2步: 遍历流中的每个chunk** (行 544-570)
```typescript
for await (const chunk of streamResponse) {
  hasReceivedAnyChunk = true;
  lastChunk = chunk;
  
  if (isValidResponse(chunk)) {
    const content = chunk.candidates?.[0]?.content;
    if (content?.parts) {
      modelResponseParts.push(...content.parts);
      if (content.parts.some(part => part.functionCall)) {
        hasToolCall = true;
      }
    }
  } else {
    isStreamInvalid = true;
  }
  yield chunk;  // 向上层传递
}
```


**第3步: 验证流有效性** (行 572-595)
```typescript
if (!hasReceivedAnyChunk) {
  throw new EmptyStreamError('Model stream completed without any chunks.');
}
if (isStreamInvalid && !hasToolCall) {
  const finishReason = lastChunk?.candidates?.[0]?.finishReason;
  if (finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    throw new EmptyStreamError('Model stream ended with invalid chunk.');
  }
}
```

**第4步: 打包模型输出** (行 597-601)
```typescript
const modelOutput: Content[] = modelResponseParts.length > 0
  ? [{ role: 'model', parts: modelResponseParts }]
  : [];
this.recordHistory(userInput, modelOutput);
```

### 🔑 有效性检查 `isValidResponse()`
```typescript
function isValidResponse(response): boolean {
  // 1. 必须有candidates
  if (!response.candidates?.length) return false;
  // 2. 必须有content
  const content = response.candidates[0]?.content;
  if (!content) return false;
  // 3. 必须有parts且非空
  if (!content.parts?.length) return false;
  // 4. 每个part必须有内容
  for (const part of content.parts) {
    if (!part || Object.keys(part).length === 0) return false;
    if (!part.thought && part.text === '') return false;
  }
  return true;
}
```

---

## STEP 6: 历史记录

### 📁 文件位置
[packages/core/src/core/geminiChat.ts:610](packages/core/src/core/geminiChat.ts#L610)

### 🎯 方法签名
```typescript
private recordHistory(
  userInput: Content,
  modelOutput: Content[],
  automaticFunctionCallingHistory?: Content[],
)
```

### 📝 详细步骤

**第1步: 处理用户输入** (行 620-640)
```typescript
// 如果有自动函数调用历史，使用它
if (automaticFunctionCallingHistory?.length > 0) {
  this.history.push(...extractCuratedHistory(automaticFunctionCallingHistory));
} else {
  // 检查是否已在历史中 (流式模式下预先添加)
  if (this.history[this.history.length - 1] !== userInput) {
    this.history.push(userInput);
  }
}
```

**第2步: 处理模型输出** (行 642-670)
```typescript
const finalModelTurns: Content[] = [];
for (const content of modelOutput) {
  // 过滤思考部分
  const visibleParts = content.parts.filter(part => !part.thought);
  const newTurn = { ...content, parts: visibleParts };
  
  // 合并相邻的模型轮次
  const lastTurn = finalModelTurns[finalModelTurns.length - 1];
  if (lastTurn?.role === 'model' && newTurn.role === 'model') {
    lastTurn.parts.push(...newTurn.parts);
  } else {
    finalModelTurns.push(newTurn);
  }
}
```

**第3步: 合并相邻文本** (行 672-695)
```typescript
for (const turn of finalModelTurns) {
  const consolidatedParts: Part[] = [];
  for (const part of turn.parts) {
    const lastPart = consolidatedParts[consolidatedParts.length - 1];
    // 如果两个都是纯文本，合并
    if (lastPart?.text && part.text && !part.functionCall) {
      lastPart.text += part.text;
    } else {
      consolidatedParts.push({ ...part });
    }
  }
  turn.parts = consolidatedParts;
}
```

**第4步: 添加到历史** (行 697-702)
```typescript
if (finalModelTurns.length > 0) {
  this.history.push(...finalModelTurns);
} else {
  // 没有有效输出，添加空占位符
  this.history.push({ role: 'model', parts: [] });
}
```

### 📊 历史结构
```typescript
// this.history 的结构
[
  { role: 'user', parts: [{ text: '环境上下文...' }] },
  { role: 'model', parts: [{ text: 'Got it!' }] },
  { role: 'user', parts: [{ text: 'IDE上下文...' }] },  // 可选
  { role: 'user', parts: [{ text: '帮我看看 src/main.ts' }] },
  { role: 'model', parts: [{ text: '好的...' }, { functionCall: {...} }] },
  // ...
]
```

---

## STEP 7: 单轮执行

### 📁 文件位置
[packages/core/src/core/turn.ts:295](packages/core/src/core/turn.ts#L295)

### 🎯 方法签名
```typescript
async *run(
  req: PartListUnion,
  signal: AbortSignal,
): AsyncGenerator<ServerGeminiStreamEvent>
```

### 📝 详细步骤


**第1步: 获取响应流** (行 305-312)
```typescript
const responseStream = await this.chat.sendMessageStream({
  message: req,
  config: { abortSignal: signal },
}, this.prompt_id);
```

**第2步: 遍历响应流** (行 314-370)
```typescript
for await (const resp of responseStream) {
  // 检查取消
  if (signal?.aborted) {
    yield { type: GeminiEventType.UserCancelled };
    return;
  }
  this.debugResponses.push(resp);
  
  // 2a. 处理思考内容
  const thoughtPart = resp.candidates?.[0]?.content?.parts?.[0];
  if (thoughtPart?.thought) {
    const rawText = thoughtPart.text ?? '';
    const subjectMatches = rawText.match(/\*\*(.*?)\*\*/s);
    yield {
      type: GeminiEventType.Thought,
      value: {
        subject: subjectMatches ? subjectMatches[1].trim() : '',
        description: rawText.replace(/\*\*(.*?)\*\*/s, '').trim(),
      },
    };
    continue;
  }
  
  // 2b. 处理文本内容
  const text = getResponseText(resp);
  if (text) {
    yield { type: GeminiEventType.Content, value: text };
  }
  
  // 2c. 处理工具调用
  const functionCalls = resp.functionCalls ?? [];
  for (const fnCall of functionCalls) {
    const event = this.handlePendingFunctionCall(fnCall);
    if (event) yield event;
  }
  
  // 2d. 收集引用
  for (const citation of getCitations(resp)) {
    this.pendingCitations.add(citation);
  }
  
  // 2e. 检查完成原因
  const finishReason = resp.candidates?.[0]?.finishReason;
  if (finishReason) {
    if (this.pendingCitations.size > 0) {
      yield { type: GeminiEventType.Citation, value: `Citations:\n${[...this.pendingCitations].join('\n')}` };
    }
    this.finishReason = finishReason;
    yield { type: GeminiEventType.Finished, value: finishReason };
  }
}
```

**第3步: 错误处理** (行 372-395)
```typescript
catch (e) {
  if (signal.aborted) {
    yield { type: GeminiEventType.UserCancelled };
    return;
  }
  const error = toFriendlyError(e);
  await reportError(error, 'Error when talking to Gemini API', ...);
  yield { type: GeminiEventType.Error, value: { error: { message: getErrorMessage(error) } } };
}
```

### 📊 事件类型
| 事件 | 说明 | 值类型 |
|------|------|--------|
| `Content` | 文本内容 | `string` |
| `Thought` | 思考过程 | `{ subject, description }` |
| `ToolCallRequest` | 工具调用请求 | `ToolCallRequestInfo` |
| `Citation` | 引用信息 | `string` |
| `Finished` | 轮次完成 | `FinishReason` |
| `Error` | 错误 | `{ error: StructuredError }` |
| `UserCancelled` | 用户取消 | 无 |

---

## STEP 8: 工具调用

### 📁 文件位置
[packages/core/src/core/turn.ts:405](packages/core/src/core/turn.ts#L405)

### 🎯 方法签名
```typescript
private handlePendingFunctionCall(
  fnCall: FunctionCall,
): ServerGeminiStreamEvent | null
```

### 📝 详细步骤

**第1步: 生成调用ID** (行 415-417)
```typescript
const callId = fnCall.id ??
  `${fnCall.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
```
- 如果API没有提供ID，自动生成一个

**第2步: 提取工具信息** (行 418-419)
```typescript
const name = fnCall.name || 'undefined_tool_name';
const args = (fnCall.args || {}) as Record<string, unknown>;
```

**第3步: 创建请求信息** (行 421-427)
```typescript
const toolCallRequest: ToolCallRequestInfo = {
  callId,
  name,
  args,
  isClientInitiated: false,  // 由模型发起
  prompt_id: this.prompt_id,
};
```

**第4步: 添加到待处理列表** (行 429)
```typescript
this.pendingToolCalls.push(toolCallRequest);
```

**第5步: 生成事件** (行 432)
```typescript
return { type: GeminiEventType.ToolCallRequest, value: toolCallRequest };
```

### 📊 ToolCallRequestInfo 结构
```typescript
{
  callId: "readFile-1702900000000-abc123",  // 唯一ID
  name: "readFile",                          // 工具名称
  args: {                                    // 工具参数
    path: "src/main.ts",
    explanation: "查看主文件"
  },
  isClientInitiated: false,                  // 由模型发起
  prompt_id: "session-123"                   // 会话ID
}
```

---

## 关键变量速查表

### GeminiClient 变量
| 变量 | 位置 | 类型 | 说明 |
|------|------|------|------|
| `chat` | [client.ts:109](packages/core/src/core/client.ts#L109) | `GeminiChat` | 聊天会话实例 |
| `contentGenerator` | [client.ts:112](packages/core/src/core/client.ts#L112) | `ContentGenerator` | API调用层 |
| `sessionTurnCount` | [client.ts:123](packages/core/src/core/client.ts#L123) | `number` | 当前会话轮次 |
| `loopDetector` | [client.ts:126](packages/core/src/core/client.ts#L126) | `LoopDetectionService` | 循环检测器 |
| `lastPromptId` | [client.ts:129](packages/core/src/core/client.ts#L129) | `string` | 上次会话ID |
| `lastSentIdeContext` | [client.ts:133](packages/core/src/core/client.ts#L133) | `IdeContext` | 上次IDE上下文 |
| `forceFullIdeContext` | [client.ts:136](packages/core/src/core/client.ts#L136) | `boolean` | 是否强制全量上下文 |
| `hasFailedCompressionAttempt` | [client.ts:139](packages/core/src/core/client.ts#L139) | `boolean` | 压缩失败标志 |


### GeminiChat 变量
| 变量 | 位置 | 类型 | 说明 |
|------|------|------|------|
| `sendPromise` | [geminiChat.ts:153](packages/core/src/core/geminiChat.ts#L153) | `Promise<void>` | 消息发送锁 |
| `config` | [geminiChat.ts:157](packages/core/src/core/geminiChat.ts#L157) | `Config` | 全局配置 |
| `contentGenerator` | [geminiChat.ts:160](packages/core/src/core/geminiChat.ts#L160) | `ContentGenerator` | API调用层 |
| `generationConfig` | [geminiChat.ts:163](packages/core/src/core/geminiChat.ts#L163) | `GenerateContentConfig` | 生成配置 |
| `history` | [geminiChat.ts:169](packages/core/src/core/geminiChat.ts#L169) | `Content[]` | 完整对话历史 |

### Turn 变量
| 变量 | 位置 | 类型 | 说明 |
|------|------|------|------|
| `pendingToolCalls` | [turn.ts:260](packages/core/src/core/turn.ts#L260) | `ToolCallRequestInfo[]` | 待处理工具调用 |
| `debugResponses` | [turn.ts:264](packages/core/src/core/turn.ts#L264) | `GenerateContentResponse[]` | 调试用响应 |
| `pendingCitations` | [turn.ts:267](packages/core/src/core/turn.ts#L267) | `Set<string>` | 待处理引用 |
| `finishReason` | [turn.ts:270](packages/core/src/core/turn.ts#L270) | `FinishReason` | 完成原因 |
| `chat` | [turn.ts:274](packages/core/src/core/turn.ts#L274) | `GeminiChat` | 聊天会话 |
| `prompt_id` | [turn.ts:277](packages/core/src/core/turn.ts#L277) | `string` | 会话ID |

### 关键常量
| 常量 | 位置 | 值 | 说明 |
|------|------|-----|------|
| `MAX_TURNS` | [client.ts:93](packages/core/src/core/client.ts#L93) | `100` | 最大轮次 |
| `COMPRESSION_TOKEN_THRESHOLD` | [client.ts:99](packages/core/src/core/client.ts#L99) | `0.7` | 压缩触发阈值 |
| `COMPRESSION_PRESERVE_THRESHOLD` | [client.ts:105](packages/core/src/core/client.ts#L105) | `0.3` | 保留历史比例 |
| `maxAttempts` | [geminiChat.ts:49](packages/core/src/core/geminiChat.ts#L49) | `3` | 最大重试次数 |
| `initialDelayMs` | [geminiChat.ts:51](packages/core/src/core/geminiChat.ts#L51) | `500` | 重试初始延迟 |

---

## 🎯 快速理解要点

### 1. 数据流向
```
用户输入 → GeminiClient.sendMessageStream()
         → Turn.run()
         → GeminiChat.sendMessageStream()
         → ContentGenerator.generateContentStream() [API调用]
         → processStreamResponse() [处理响应]
         → recordHistory() [记录历史]
         → 事件流输出
```

### 2. 历史管理
- **完整历史** (`history`): 包含所有消息，包括无效的
- **策划历史** (`getHistory(true)`): 只包含有效消息，用于API调用
- 历史结构: `[user, model, user, model, ...]`

### 3. 事件流
```
sendMessageStream() 生成的事件:
├── ChatCompressed (如果压缩了)
├── LoopDetected (如果检测到循环)
├── MaxSessionTurns (如果超过轮次)
└── Turn.run() 生成的事件:
    ├── Thought (思考过程)
    ├── Content (文本内容)
    ├── ToolCallRequest (工具调用)
    ├── Citation (引用)
    ├── Finished (完成)
    ├── Error (错误)
    └── UserCancelled (取消)
```

### 4. 重试机制
- **API级别**: `retryWithBackoff()` 处理 429/5xx 错误
- **内容级别**: `EmptyStreamError` 触发最多3次重试
- **模型降级**: 429错误时可能降级到Flash模型

### 5. 工具调用流程
```
模型返回 functionCall
    ↓
Turn.handlePendingFunctionCall()
    ↓
生成 ToolCallRequest 事件
    ↓
上层处理工具调用 (执行工具)
    ↓
返回 ToolCallResponse
    ↓
继续对话
```

---

## 📚 相关文件

| 文件 | 说明 |
|------|------|
| [client.ts](packages/core/src/core/client.ts) | 主客户端，管理会话生命周期 |
| [geminiChat.ts](packages/core/src/core/geminiChat.ts) | 聊天会话，管理历史和流式通信 |
| [turn.ts](packages/core/src/core/turn.ts) | 单轮对话，生成事件流 |
| [contentGenerator.ts](packages/core/src/core/contentGenerator.ts) | API调用抽象层 |
| [prompts.ts](packages/core/src/core/prompts.ts) | 系统提示词 |
| [tokenLimits.ts](packages/core/src/core/tokenLimits.ts) | Token限制配置 |

