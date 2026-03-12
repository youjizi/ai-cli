# Requirements Document

## Introduction

将 Z.ai Python SDK (z-ai-sdk-python) 翻译为 TypeScript SDK，放入 ai-cli 项目中作为一个新的包 `@ai-cli/zai-sdk`。该 SDK 提供与 Z.ai 开放平台 API 交互的能力，包括聊天补全、嵌入、视频生成、音频处理等功能。

## Glossary

- **ZaiClient**: Z.ai API 的主客户端类，用于海外用户
- **ZhipuAiClient**: 智谱 AI API 的客户端类，用于中国大陆用户
- **Chat_Completions**: 聊天补全 API 资源，支持标准聊天和流式响应
- **Embeddings**: 文本嵌入 API 资源，生成向量嵌入
- **HttpClient**: HTTP 客户端基类，处理请求、重试和错误
- **StreamResponse**: 流式响应处理类
- **BaseAPI**: 所有 API 资源类的基类

## Requirements

### Requirement 1: 核心客户端实现

**User Story:** As a developer, I want to create a ZaiClient instance with API key configuration, so that I can authenticate and make API requests to Z.ai platform.

#### Acceptance Criteria

1. THE ZaiClient SHALL accept api_key parameter for authentication
2. THE ZaiClient SHALL accept optional base_url parameter to customize API endpoint
3. WHEN api_key is not provided, THE ZaiClient SHALL attempt to read from ZAI_API_KEY environment variable
4. IF api_key is not found in parameters or environment, THEN THE ZaiClient SHALL throw a ZaiError
5. THE ZhipuAiClient SHALL use default base URL `https://open.bigmodel.cn/api/paas/v4`
6. THE ZaiClient SHALL use default base URL `https://api.z.ai/api/paas/v4`
7. THE ZaiClient SHALL support timeout configuration with default value
8. THE ZaiClient SHALL support max_retries configuration with default value of 2

### Requirement 2: HTTP 客户端基础设施

**User Story:** As a developer, I want the SDK to handle HTTP requests with proper error handling and retry logic, so that I can reliably communicate with the API.

#### Acceptance Criteria

1. THE HttpClient SHALL build requests with proper headers including Authorization, Content-Type, and SDK version
2. WHEN a request times out, THE HttpClient SHALL retry up to max_retries times with exponential backoff
3. WHEN a 429 (rate limit) response is received, THE HttpClient SHALL retry the request
4. WHEN a 5xx response is received, THE HttpClient SHALL retry the request
5. IF all retries are exhausted, THEN THE HttpClient SHALL throw an appropriate error
6. THE HttpClient SHALL support both JSON and multipart/form-data content types
7. WHEN streaming is enabled, THE HttpClient SHALL return a StreamResponse object

### Requirement 3: 聊天补全 API

**User Story:** As a developer, I want to create chat completions with various models, so that I can build conversational AI applications.

#### Acceptance Criteria

1. WHEN creating a chat completion, THE Chat_Completions SHALL accept model and messages parameters
2. THE Chat_Completions SHALL support optional parameters: temperature, top_p, max_tokens, seed, stop
3. WHEN stream is set to true, THE Chat_Completions SHALL return a StreamResponse of ChatCompletionChunk
4. WHEN stream is false or not set, THE Chat_Completions SHALL return a Completion object
5. THE Chat_Completions SHALL support tools parameter for function calling
6. THE Chat_Completions SHALL support multimodal messages with image content
7. WHEN temperature is <= 0, THE Chat_Completions SHALL set do_sample to false and temperature to 0.01
8. WHEN temperature is >= 1, THE Chat_Completions SHALL clamp temperature to 0.99

### Requirement 4: 嵌入 API

**User Story:** As a developer, I want to generate text embeddings, so that I can perform semantic search and similarity comparisons.

#### Acceptance Criteria

1. THE Embeddings SHALL accept model and input parameters
2. THE Embeddings SHALL support single string or array of strings as input
3. THE Embeddings SHALL return an EmbeddingResponse with embedding vectors
4. THE Embeddings SHALL support optional dimensions parameter

### Requirement 5: 错误处理

**User Story:** As a developer, I want clear error messages and typed errors, so that I can handle API failures appropriately.

#### Acceptance Criteria

1. WHEN a 400 response is received, THE SDK SHALL throw APIRequestFailedError
2. WHEN a 401 response is received, THE SDK SHALL throw APIAuthenticationError
3. WHEN a 429 response is received after retries, THE SDK SHALL throw APIReachLimitError
4. WHEN a 500 response is received after retries, THE SDK SHALL throw APIInternalError
5. WHEN a 503 response is received after retries, THE SDK SHALL throw APIServerFlowExceedError
6. WHEN a connection error occurs, THE SDK SHALL throw APIConnectionError
7. WHEN a timeout occurs after retries, THE SDK SHALL throw APITimeoutError
8. ALL error classes SHALL extend a base ZaiError class

### Requirement 6: 类型定义

**User Story:** As a developer, I want comprehensive TypeScript types, so that I can have type safety and IDE autocompletion.

#### Acceptance Criteria

1. THE SDK SHALL export types for all request parameters
2. THE SDK SHALL export types for all response objects
3. THE SDK SHALL export types for ChatMessage, ChatCompletionChunk, Completion
4. THE SDK SHALL export types for EmbeddingRequest and EmbeddingResponse
5. THE SDK SHALL use strict TypeScript configuration

### Requirement 7: 流式响应处理

**User Story:** As a developer, I want to consume streaming responses easily, so that I can display real-time AI responses.

#### Acceptance Criteria

1. THE StreamResponse SHALL implement AsyncIterable interface
2. WHEN iterating over StreamResponse, THE SDK SHALL yield parsed chunk objects
3. THE StreamResponse SHALL handle SSE (Server-Sent Events) format
4. WHEN the stream ends, THE StreamResponse SHALL properly close the connection
5. IF an error occurs during streaming, THEN THE StreamResponse SHALL throw an appropriate error

### Requirement 8: 视频生成 API

**User Story:** As a developer, I want to generate videos from text or images, so that I can create AI-generated video content.

#### Acceptance Criteria

1. THE Videos SHALL support text-to-video generation with prompt parameter
2. THE Videos SHALL support image-to-video generation with image parameter
3. THE Videos SHALL support quality, size, fps, and with_audio parameters
4. THE Videos SHALL provide a method to retrieve video generation results by ID

### Requirement 9: 音频处理 API

**User Story:** As a developer, I want to transcribe audio files, so that I can convert speech to text.

#### Acceptance Criteria

1. THE Audio SHALL support file upload for transcription
2. THE Audio SHALL accept model parameter for transcription
3. THE Audio SHALL return transcription text in response

### Requirement 10: 文件管理 API

**User Story:** As a developer, I want to upload and manage files, so that I can use them with other API features.

#### Acceptance Criteria

1. THE Files SHALL support file upload with purpose parameter
2. THE Files SHALL support file listing
3. THE Files SHALL support file deletion by ID
4. THE Files SHALL support file retrieval by ID
