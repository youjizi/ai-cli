# Requirements: LLM 抽象层

> **对应需求文档**: gemini-cli/.kiro/specs/multi-provider-llm-abstraction/requirements.md

本文档继承 gemini-cli 中定义的完整需求，在 ai-cli-project 中实现。

## 需求引用

详细需求定义见: `gemini-cli/.kiro/specs/multi-provider-llm-abstraction/requirements.md`

### 核心需求摘要

1. **统一类型系统** - 定义厂商无关的消息、内容、工具类型
2. **适配器接口** - 定义 LLMProviderAdapter 统一接口
3. **工具调用格式** - 使用标准 JSON Schema 定义工具
4. **提供商注册表** - 管理多个 LLM 提供商
5. **Gemini 适配器** - 保持与现有功能兼容
6. **OpenAI 适配器** - 支持 GPT 系列模型
7. **Anthropic 适配器** - 支持 Claude 系列模型
8. **核心模块重构** - 使用统一类型重构 Chat/Turn
9. **错误处理** - 统一错误分类和重试机制
10. **向后兼容** - 支持渐进式迁移
