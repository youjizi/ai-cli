# Gemini CLI Core 完整架构分析

> 本文档全面分析 gemini-cli/packages/core 的模块结构，作为重构通用 Core 的参考。

## 1. 模块总览

```
gemini-cli/packages/core/src/
├── agents/          # Agent 系统（子代理执行）
├── availability/    # 模型可用性服务
├── code_assist/     # Google Code Assist 集成（OAuth、服务器）
├── commands/        # 命令扩展
├── config/          # 配置系统（核心）
├── confirmation-bus/# 工具确认消息总线
├── core/            # 核心 LLM 交互（ContentGenerator、Chat、Turn）
├── fallback/        # 模型降级处理
├── generated/       # 生成的代码
├── hooks/           # Hook 系统（事件钩子）
├── ide/             # IDE 集成
├── mcp/             # MCP (Model Context Protocol) 集成
├── output/          # 输出格式化
├── policy/          # 策略引擎（权限控制）
├── prompts/         # Prompt 注册和管理
├── routing/         # 模型路由
├── safety/          # 安全检查
├── services/        # 服务层（文件、Git、压缩等）
├── telemetry/       # 遥测和日志
├── test-utils/      # 测试工具
├── tools/           # 工具系统（核心）
├── utils/           # 工具函数
└── index.ts         # 模块导出
```

## 2. 核心模块分类

### 2.1 必须重构的核心模块（与 LLM 交互直接相关）

| 模块 | 职责 | Google SDK 依赖程度 |
|------|------|-------------------|
| `core/` | LLM 交互核心 | **深度依赖** |
| `tools/` | 工具定义和执行 | **中度依赖** (FunctionDeclaration) |
| `agents/` | Agent 执行器 | **中度依赖** |
| `config/` | 配置管理 | **轻度依赖** |

### 2.2 可复用的通用模块（与 LLM 厂商无关）

| 模块 | 职责 | 可复用性 |
|------|------|---------|
| `utils/` | 工具函数 | **高** |
| `services/` | 文件、Git 等服务 | **高** |
| `policy/` | 策略引擎 | **高** |
| `confirmation-bus/` | 消息总线 | **高** |
| `hooks/` | 事件钩子 | **中** (部分依赖 Google 类型) |
| `output/` | 输出格式化 | **高** |
| `telemetry/` | 遥测 | **高** |

### 2.3 Google 特定模块（可能不需要重构）

| 模块 | 职责 | 说明 |
|------|------|------|
| `code_assist/` | Google Code Assist | Google 特有 |
| `mcp/` | MCP OAuth | 可通用化 |
| `ide/` | IDE 集成 | 可通用化 |

## 3. 核心模块详细分析

### 3.1 core/ 模块

```
core/
├── contentGenerator.ts    # LLM API 封装接口
├── loggingContentGenerator.ts  # 日志装饰器
├── recordingContentGenerator.ts # 录制装饰器
├── fakeContentGenerator.ts     # 测试用假实现
├── geminiChat.ts          # 对话管理
├── turn.ts                # 单轮交互处理
├── coreToolScheduler.ts   # 工具调度器
├── baseLlmClient.ts       # 基础 LLM 客户端
├── client.ts              # Gemini 客户端
├── prompts.ts             # Prompt 构建
├── tokenLimits.ts         # Token 限制
├── geminiRequest.ts       # 请求构建
├── logger.ts              # 日志
├── apiKeyCredentialStorage.ts  # API Key 存储
└── nonInteractiveToolExecutor.ts # 非交互工具执行
```

**关键类型依赖**:
- `Content`, `Part`, `FunctionCall`, `FunctionResponse` (消息)
- `GenerateContentParameters`, `GenerateContentResponse` (请求/响应)
- `Tool`, `FunctionDeclaration` (工具)
- `FinishReason` (完成原因)

### 3.2 tools/ 模块

```
tools/
├── tools.ts              # 工具基类和接口
├── tool-registry.ts      # 工具注册表
├── tool-error.ts         # 工具错误类型
├── tool-names.ts         # 工具名称常量
├── mcp-client.ts         # MCP 客户端
├── mcp-client-manager.ts # MCP 管理器
├── mcp-tool.ts           # MCP 工具
├── modifiable-tool.ts    # 可修改工具
│
├── read-file.ts          # 读文件
├── read-many-files.ts    # 读多文件
├── write-file.ts         # 写文件
├── edit.ts               # 编辑文件
├── smart-edit.ts         # 智能编辑
├── ls.ts                 # 列目录
├── grep.ts               # 搜索
├── ripGrep.ts            # RipGrep 搜索
├── glob.ts               # Glob 匹配
├── shell.ts              # Shell 执行
├── web-fetch.ts          # Web 获取
├── web-search.ts         # Web 搜索
├── memoryTool.ts         # 记忆工具
└── write-todos.ts        # TODO 列表
```

**关键接口**:
```typescript
interface ToolBuilder<TParams, TResult> {
  name: string;
  displayName: string;
  description: string;
  kind: Kind;
  schema: FunctionDeclaration;  // Google 类型
  build(params: TParams): ToolInvocation<TParams, TResult>;
}

interface ToolInvocation<TParams, TResult> {
  params: TParams;
  getDescription(): string;
  shouldConfirmExecute(signal): Promise<ToolCallConfirmationDetails | false>;
  execute(signal, updateOutput?): Promise<TResult>;
}

interface ToolResult {
  llmContent: PartListUnion;  // Google 类型
  returnDisplay: ToolResultDisplay;
  error?: { message: string; type?: ToolErrorType };
}
```

### 3.3 agents/ 模块

```
agents/
├── types.ts              # Agent 类型定义
├── executor.ts           # Agent 执行器
├── registry.ts           # Agent 注册表
├── invocation.ts         # Agent 调用
├── utils.ts              # 工具函数
├── schema-utils.ts       # Schema 工具
├── subagent-tool-wrapper.ts  # 子代理工具包装
└── codebase-investigator.ts  # 代码库调查器
```

**关键接口**:
```typescript
interface AgentDefinition<TOutput> {
  name: string;
  displayName?: string;
  description: string;
  promptConfig: PromptConfig;
  modelConfig: ModelConfig;
  runConfig: RunConfig;
  toolConfig?: ToolConfig;
  outputConfig?: OutputConfig<TOutput>;
  inputConfig: InputConfig;
}

class AgentExecutor<TOutput> {
  async run(inputs: AgentInputs, signal: AbortSignal): Promise<OutputObject>
}
```

### 3.4 config/ 模块

```
config/
├── config.ts             # 主配置类 (巨大，800+ 行)
├── constants.ts          # 常量
├── models.ts             # 模型配置
├── defaultModelConfigs.ts # 默认模型配置
└── storage.ts            # 存储
```

**Config 类职责** (过于庞大):
- ContentGenerator 管理
- ToolRegistry 管理
- AgentRegistry 管理
- MCP 服务器管理
- 文件服务管理
- Git 服务管理
- 遥测配置
- 策略引擎
- 消息总线
- 模型路由
- ... 更多

### 3.5 services/ 模块

```
services/
├── fileDiscoveryService.ts   # 文件发现
├── fileSystemService.ts      # 文件系统
├── gitService.ts             # Git 操作
├── chatRecordingService.ts   # 对话录制
├── chatCompressionService.ts # 对话压缩
├── shellExecutionService.ts  # Shell 执行
├── modelConfigService.ts     # 模型配置服务
└── loopDetectionService.ts   # 循环检测
```

### 3.6 hooks/ 模块

```
hooks/
├── types.ts              # Hook 类型定义
├── hookRegistry.ts       # Hook 注册表
├── hookPlanner.ts        # Hook 计划器
├── hookRunner.ts         # Hook 执行器
├── hookAggregator.ts     # Hook 聚合器
└── hookTranslator.ts     # Hook 翻译器
```

**Hook 事件**:
- BeforeTool / AfterTool
- BeforeAgent / AfterAgent
- BeforeModel / AfterModel
- SessionStart / SessionEnd
- PreCompress
- BeforeToolSelection
- Notification

## 4. 依赖关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Config (中心)                              │
│  - 持有所有服务实例                                                   │
│  - 管理生命周期                                                       │
└─────────────────────────────────────────────────────────────────────┘
         │
         ├──────────────────┬──────────────────┬──────────────────┐
         ▼                  ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ ContentGenerator│ │  ToolRegistry   │ │  AgentRegistry  │ │    Services     │
│ - generateContent│ │ - registerTool │ │ - registerAgent │ │ - FileService   │
│ - stream        │ │ - getTool      │ │ - getAgent      │ │ - GitService    │
│ - countTokens   │ │ - getAllTools  │ │                 │ │ - etc.          │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   GeminiChat    │ │ CoreToolScheduler│ │  AgentExecutor  │
│ - history       │ │ - schedule      │ │ - run           │
│ - sendMessage   │ │ - execute       │ │ - executeTurn   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                              Turn                                    │
│  - 处理单轮交互                                                       │
│  - 产出事件流                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

## 5. 重构建议

### 5.1 分层架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Layer 4: Application                         │
│  AgentExecutor, CLI, IDE Integration                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                         Layer 3: Orchestration                       │
│  UnifiedChat, UnifiedTurn, ToolScheduler                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                         Layer 2: Abstraction                         │
│  LLMProviderAdapter, UnifiedTypes, ToolRegistry                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                         Layer 1: Foundation                          │
│  Utils, Services, Policy, MessageBus                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 模块重构优先级

| 优先级 | 模块 | 原因 |
|--------|------|------|
| P0 | `core/` → `llm/` | LLM 抽象是基础 |
| P1 | `tools/` | 工具系统依赖 LLM 类型 |
| P2 | `agents/` | Agent 依赖 Chat 和 Tools |
| P3 | `config/` | 需要拆分，太大了 |
| P4 | `hooks/` | 部分依赖 Google 类型 |

### 5.3 Config 拆分建议

当前 Config 类太大（800+ 行），建议拆分为：

```
config/
├── core-config.ts        # 核心配置（模型、认证）
├── tool-config.ts        # 工具配置
├── agent-config.ts       # Agent 配置
├── service-config.ts     # 服务配置
├── telemetry-config.ts   # 遥测配置
└── config.ts             # 组合配置（Facade）
```

## 6. 通用 Core 目标结构

```
ai-cli-project/packages/core/src/
├── llm/                  # LLM 抽象层 (Phase 1)
│   ├── types/            # 统一类型
│   ├── adapters/         # 适配器实现
│   ├── chat/             # 对话管理
│   └── utils/            # LLM 工具函数
│
├── tools/                # 工具系统 (Phase 2)
│   ├── types/            # 工具类型（厂商无关）
│   ├── registry/         # 工具注册
│   ├── scheduler/        # 工具调度
│   └── builtin/          # 内置工具
│
├── agents/               # Agent 系统 (Phase 3)
│   ├── types/            # Agent 类型
│   ├── executor/         # Agent 执行
│   └── registry/         # Agent 注册
│
├── services/             # 服务层 (可直接复用)
│   ├── file/
│   ├── git/
│   └── shell/
│
├── config/               # 配置系统 (Phase 4)
│   ├── core/
│   ├── tool/
│   └── agent/
│
├── policy/               # 策略引擎 (可直接复用)
├── hooks/                # Hook 系统 (Phase 5)
├── utils/                # 工具函数 (可直接复用)
└── index.ts
```

## 7. 实现路线图

### Phase 1: LLM 抽象层 (当前)
- 统一类型系统
- 适配器接口
- Gemini 适配器
- 对话管理

### Phase 2: 工具系统
- 统一工具类型（移除 FunctionDeclaration 依赖）
- 工具注册表重构
- 工具调度器重构

### Phase 3: Agent 系统
- Agent 类型重构
- Agent 执行器重构

### Phase 4: 配置系统
- Config 拆分
- 依赖注入改进

### Phase 5: Hook 系统
- 移除 Google 类型依赖
- 统一事件类型

### Phase 6: 其他适配器
- OpenAI 适配器
- Anthropic 适配器

---

*文档版本: 1.0*
*最后更新: 2025-12-20*
