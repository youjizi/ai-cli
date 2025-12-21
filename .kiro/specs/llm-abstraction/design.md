# Design: LLM 抽象层

> **对应设计文档**: gemini-cli/.kiro/specs/multi-provider-llm-abstraction/design.md
> **参考分析**: ai-cli-project/dosc/gemini-cli-core-analysis.md

本文档继承 gemini-cli 中定义的完整设计，在 ai-cli-project 中实现。

## 设计引用

详细设计见: `gemini-cli/.kiro/specs/multi-provider-llm-abstraction/design.md`

## 实现架构

```
ai-cli-project/packages/core/src/llm/
├── types/          # 统一类型定义
├── utils/          # 基础工具 (errors, retry)
├── adapter/        # 适配器接口
├── adapters/       # 适配器实现
│   ├── gemini/
│   ├── openai/
│   └── anthropic/
├── chat/           # 对话管理
└── index.ts        # 模块入口
```

## 实现顺序

1. **基础层** → utils/errors.ts, utils/retry.ts
2. **类型层** → types/*.ts
3. **接口层** → adapter/interface.ts
4. **适配器** → adapters/gemini/*.ts
5. **对话层** → chat/*.ts
6. **扩展** → 工具调用、注册表、其他适配器

## 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 实现位置 | ai-cli-project | 隔离风险，干净起点 |
| 构建顺序 | 从底层往上 | 稳扎稳打，每层可测试 |
| 先实现 | Gemini 适配器 | 有参考实现，可验证设计 |
| 测试框架 | vitest + fast-check | 单元测试 + 属性测试 |
