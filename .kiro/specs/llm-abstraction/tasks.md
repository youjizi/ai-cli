# Implementation Plan: LLM 抽象层详细任务

> **对应大任务**: gemini-cli/.kiro/specs/multi-provider-llm-abstraction/tasks.md
> **参考文档**: ai-cli-project/dosc/gemini-cli-core-analysis.md
> **实现位置**: ai-cli-project/packages/core/src/llm/

---

## Phase 1: 基础工具层

- [x] 1. 创建基础工具函数
  - [x] 1.1 创建 `llm/utils/errors.ts` 错误类型 ✅
  - [x] 1.2 创建 `llm/utils/retry.ts` 重试机制 ✅
  - [x] 1.3 创建 `llm/utils/delay.ts` 延迟工具 ✅
  - [ ] 1.4 编写重试机制单元测试 `llm/utils/__tests__/retry.test.ts`

- [ ] 2. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 2: 统一类型系统

- [x] 3. 定义消息类型
  - [x] 3.1 创建 `llm/types/message.ts` ✅

- [x] 4. 定义工具类型
  - [x] 4.1 创建 `llm/types/tool.ts` ✅ (使用自定义 JsonSchema 类型，无需额外依赖)

- [x] 5. 定义流式事件类型
  - [x] 5.1 创建 `llm/types/stream.ts` ✅

- [x] 6. 创建类型导出
  - [x] 6.1 创建 `llm/types/index.ts` ✅
  - [ ] 6.2 编写类型属性测试 `llm/types/__tests__/types.test.ts`

- [ ] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 3: 适配器接口

- [x] 8. 定义适配器契约
  - [x] 8.1 创建 `llm/adapter/interface.ts` ✅
  - [ ] 8.2 编写适配器接口测试 `llm/adapter/__tests__/interface.test.ts`

- [ ] 9. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 4: Gemini 适配器

- [x] 10. 实现类型转换器
  - [x] 10.1 创建 `llm/adapters/gemini/converter.ts` ✅

- [x] 11. 实现流处理器
  - [x] 11.1 创建 `llm/adapters/gemini/stream-processor.ts` ✅

- [x] 12. 实现适配器核心
  - [x] 12.1 创建 `llm/adapters/gemini/adapter.ts` ✅
  - [x] 12.2 创建 `llm/adapters/gemini/index.ts` ✅
  - [ ] 12.3 编写 Gemini 适配器测试 `llm/adapters/gemini/__tests__/`

- [ ] 13. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 5: 对话管理

- [x] 14. 实现历史管理
  - [x] 14.1 创建 `llm/chat/history.ts` ✅

- [x] 15. 实现对话类
  - [x] 15.1 创建 `llm/chat/chat.ts` ✅

- [x] 16. 实现轮次处理
  - [x] 16.1 创建 `llm/chat/turn.ts` ✅
  - [ ] 16.2 编写对话管理测试 `llm/chat/__tests__/`

- [ ] 17. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 6: 端到端验证

- [x] 18. 创建示例
  - [x] 18.1 创建 `llm/examples/basic-chat.ts` ✅
  - [x] 18.2 创建 `llm/examples/streaming.ts` ✅
  - [ ] 18.3 编写集成测试 `llm/__tests__/integration.test.ts`

- [ ] 19. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 7-10: 后续扩展（待实现）

- [ ] 20. 工具调用支持
- [ ] 21. 提供商注册表
- [ ] 22. OpenAI 适配器
- [ ] 23. Anthropic 适配器

---

## 当前文件结构

```
ai-cli-project/packages/core/src/llm/
├── types/
│   ├── message.ts      ✅
│   ├── tool.ts         ✅
│   ├── stream.ts       ✅
│   └── index.ts        ✅
├── utils/
│   ├── errors.ts       ✅
│   ├── retry.ts        ✅
│   ├── delay.ts        ✅
│   └── index.ts        ✅
├── adapter/
│   ├── interface.ts    ✅
│   └── index.ts        ✅
├── adapters/
│   └── gemini/
│       ├── adapter.ts          ✅
│       ├── converter.ts        ✅
│       ├── stream-processor.ts ✅
│       └── index.ts            ✅
├── chat/
│   ├── history.ts      ✅
│   ├── chat.ts         ✅
│   ├── turn.ts         ✅
│   └── index.ts        ✅
├── examples/
│   ├── basic-chat.ts   ✅
│   └── streaming.ts    ✅
└── index.ts            ✅
```

---

## 进度总结

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 | 🟡 | 代码完成，测试待写 |
| Phase 2 | 🟡 | 代码完成，测试待写 |
| Phase 3 | 🟡 | 代码完成，测试待写 |
| Phase 4 | 🟡 | 代码完成，测试待写 |
| Phase 5 | 🟡 | 代码完成，测试待写 |
| Phase 6 | 🟡 | 示例完成，集成测试待写 |
| Phase 7-10 | ⚪ | 待实现 |

**下一步**: 运行示例验证基础功能，然后补充单元测试
