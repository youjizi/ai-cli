/**
 * 统一工具类型
 * 
 * 定义跨提供商的标准化工具格式
 * Requirements: 1.3, 1.4, 3.1
 */

/**
 * JSON Schema 类型 (简化版)
 * 
 * 用于定义工具参数结构，兼容各 LLM 厂商的工具定义格式
 */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: unknown[];
  description?: string;
  default?: unknown;
  [key: string]: unknown;  // 允许其他 JSON Schema 属性
}

/**
 * 统一工具模式
 */
export interface UnifiedToolSchema {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 参数定义 (JSON Schema 格式) */
  parameters: JsonSchema;
}

/**
 * 工具选择模式
 */
export type UnifiedToolChoice =
  | 'auto'      // 模型自动决定是否调用工具
  | 'none'      // 禁止调用工具
  | 'required'  // 必须调用工具
  | { name: string };  // 强制调用指定工具

/**
 * 工具配置
 */
export interface UnifiedToolConfig {
  /** 可用工具列表 */
  tools?: UnifiedToolSchema[];
  /** 工具选择模式 */
  toolChoice?: UnifiedToolChoice;
}

// ==================== 辅助函数 ====================

/**
 * 创建简单工具模式
 */
export function createToolSchema(
  name: string,
  description: string,
  properties: Record<string, JsonSchema>,
  required?: string[],
): UnifiedToolSchema {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
      required,
    },
  };
}

/**
 * 验证工具模式是否有效
 */
export function isValidToolSchema(schema: UnifiedToolSchema): boolean {
  return (
    typeof schema.name === 'string' &&
    schema.name.length > 0 &&
    typeof schema.description === 'string' &&
    schema.parameters !== null &&
    typeof schema.parameters === 'object'
  );
}
