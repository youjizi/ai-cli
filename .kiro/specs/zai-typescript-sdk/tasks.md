# Implementation Plan: Z.ai TypeScript SDK

## Overview

将 z-ai-sdk-python 翻译为 TypeScript SDK，放入 ai-cli/packages/zai-sdk 目录。采用增量实现方式，从核心基础设施开始，逐步构建 API 资源。 补充中文注释

## Tasks

- [x] 1. 项目初始化和核心基础设施
  - [x] 1.1 创建 packages/zai-sdk 目录结构和 package.json
    - 创建目录: src/core, src/api, src/types, tests
    - 配置 package.json 依赖和脚本
    - 配置 tsconfig.json
    - _Requirements: 6.5_

  - [x] 1.2 实现错误类层次结构
    - 创建 src/core/errors.ts
    - 实现 ZaiError 基类
    - 实现 APIStatusError, APIRequestFailedError, APIAuthenticationError, APIReachLimitError, APIInternalError, APIServerFlowExceedError
    - 实现 APIConnectionError, APITimeoutError, APIResponseValidationError
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 1.3 编写错误类属性测试
    - **Property 7: Error Class Hierarchy**
    - **Validates: Requirements 5.8**

  - [x] 1.4 实现常量定义
    - 创建 src/core/constants.ts
    - 定义 DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES, DEFAULT_LIMITS
    - 定义 INITIAL_RETRY_DELAY, MAX_RETRY_DELAY
    - _Requirements: 1.7, 1.8_

- [-] 2. HTTP 客户端实现
  - [x] 2.1 实现 HttpClient 基础功能
    - 创建 src/core/http-client.ts
    - 实现请求构建 (buildRequest)
    - 实现请求头构建 (Authorization, Content-Type, SDK version)
    - 实现基本的 request 方法
    - _Requirements: 2.1, 2.6_

  - [x] 2.2 编写请求头构建属性测试
    - **Property 4: Request Header Construction**
    - **Validates: Requirements 2.1**

  - [x] 2.3 实现重试逻        zz辑
    - 实现 shouldRetry 方法 (429, 5xx, timeout)
    - 实现 calculateRetryDelay 指数退避
    - 实现 retryRequest 方法
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 2.4 编写重试逻辑属性测试
    - **Property 5: Retry on Retryable Errors**
    - **Validates: Requirements 2.2, 2.3, 2.4**
      
  - [ ] 2.5 实现错误状态映射
    - 实现 makeStatusError 方法
    - 根据 HTTP 状态码返回对应错误类型
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 2.6 编写错误映射属性测试
    - **Property 6: Error Type Mapping**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 3. Checkpoint - 确保核心基础设施测试通过
  - 运行所有测试，确保通过
  - 如有问题，询问用户

- [ ] 4. 流式响应实现
  - [ ] 4.1 实现 SSE 解析器
    - 创建 src/core/streaming.ts
    - 实现 SSEParser 类
    - 实现 iterLines 生成器方法
    - 处理 event, data, id, retry 字段
    - _Requirements: 7.3_

  - [ ] 4.2 编写 SSE 解析属性测试
    - **Property 10: SSE Stream Parsing**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ] 4.3 实现 StreamResponse 类
    - 实现 AsyncIterable 接口
    - 实现 [Symbol.asyncIterator] 方法
    - 处理 [DONE] 标记
    - 处理流式错误
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [ ] 5. 客户端类实现
  - [ ] 5.1 实现 BaseClient 类
    - 创建 src/client.ts
    - 实现构造函数和配置处理
    - 实现 API key 验证和环境变量回退
    - 实现懒加载 API 资源属性
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.8_

  - [ ] 5.2 编写客户端配置属性测试
    - **Property 1: Client Configuration Validation**
    - **Validates: Requirements 1.1, 1.2, 1.7, 1.8**

  - [ ] 5.3 实现 ZaiClient 和 ZhipuAiClient
    - 继承 BaseClient
    - 设置各自的默认 base URL
    - ZaiClient 添加 Accept-Language 头
    - _Requirements: 1.5, 1.6_

  - [ ] 5.4 编写 API Key 回退测试
    - **Property 2: API Key Environment Fallback**
    - **Property 3: Missing API Key Error**
    - **Validates: Requirements 1.3, 1.4**

- [ ] 6. Checkpoint - 确保客户端测试通过
  - 运行所有测试，确保通过
  - 如有问题，询问用户

- [ ] 7. Chat Completions API 实现
  - [ ] 7.1 定义 Chat 类型
    - 创建 src/types/chat/completion.ts
    - 定义 ChatMessage, ContentPart, ChatCompletionCreateParams
    - 定义 Completion, CompletionChoice, CompletionMessage, CompletionUsage
    - _Requirements: 6.3_

  - [ ] 7.2 定义 ChatCompletionChunk 类型
    - 创建 src/types/chat/chunk.ts
    - 定义 ChatCompletionChunk, ChunkChoice, ChoiceDelta
    - _Requirements: 6.3_

  - [ ] 7.3 实现 BaseAPI 类
    - 创建 src/api/base.ts
    - 实现 get, post, delete, put, patch 方法
    - _Requirements: 2.1_

  - [ ] 7.4 实现 Completions API
    - 创建 src/api/chat/completions.ts
    - 实现 create 方法
    - 实现温度钳制逻辑
    - 支持流式和非流式响应
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 7.5 编写温度钳制属性测试
    - **Property 8: Temperature Clamping**
    - **Validates: Requirements 3.7, 3.8**

  - [ ] 7.6 编写流式响应类型属性测试
    - **Property 9: Stream Response Type**
    - **Validates: Requirements 3.3, 3.4, 2.7**

  - [ ] 7.7 实现 Chat 资源类
    - 创建 src/api/chat/index.ts
    - 组合 Completions API
    - _Requirements: 3.1_

- [ ] 8. Embeddings API 实现
  - [ ] 8.1 定义 Embedding 类型
    - 创建 src/types/embeddings.ts
    - 定义 EmbeddingCreateParams, EmbeddingResponse, Embedding
    - _Requirements: 6.4_

  - [ ] 8.2 实现 Embeddings API
    - 创建 src/api/embeddings/index.ts
    - 实现 create 方法
    - 支持单字符串和字符串数组输入
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 8.3 编写 Embedding 输入属性测试
    - **Property 12: Embedding Input Flexibility**
    - **Validates: Requirements 4.1, 4.2**

- [ ] 9. Videos API 实现
  - [ ] 9.1 定义 Video 类型
    - 创建 src/types/video.ts
    - 定义 VideoCreateParams, VideoObject, VideoResult
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 9.2 实现 Videos API
    - 创建 src/api/videos/index.ts
    - 实现 generations 方法
    - 实现 retrieveResult 方法
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 9.3 编写 Video 参数属性测试
    - **Property 13: Video Generation Parameters**
    - **Validates: Requirements 8.3**

- [ ] 10. Files API 实现
  - [ ] 10.1 定义 File 类型
    - 创建 src/types/files.ts
    - 定义 FileCreateParams, FileObject, FileDeleted, ListOfFileObject
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 10.2 实现 Files API
    - 创建 src/api/files/index.ts
    - 实现 create 方法 (multipart/form-data)
    - 实现 list 方法
    - 实现 delete 方法
    - 实现 content 方法
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 11. Audio API 实现
  - [ ] 11.1 定义 Audio 类型
    - 创建 src/types/audio.ts
    - 定义 TranscriptionCreateParams, TranscriptionResponse
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 11.2 实现 Audio API
    - 创建 src/api/audio/index.ts
    - 实现 transcriptions.create 方法
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 12. 导出和集成
  - [ ] 12.1 创建类型导出
    - 创建 src/types/index.ts
    - 导出所有公共类型
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 12.2 创建核心导出
    - 创建 src/core/index.ts
    - 导出 HttpClient, StreamResponse, 错误类
    - _Requirements: 5.8_

  - [ ] 12.3 创建主入口
    - 创建 src/index.ts
    - 导出 ZaiClient, ZhipuAiClient
    - 导出所有类型和错误类
    - _Requirements: 1.1, 1.5, 1.6_

- [ ] 13. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证类型检查通过
  - 如有问题，询问用户

## Notes

- 所有任务均为必需，包括完整的属性测试
- 每个任务引用具体的需求以保证可追溯性
- Checkpoint 任务确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
