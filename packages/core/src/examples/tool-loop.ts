import { GoogleGenAI } from '@google/genai';
import type { FunctionDeclaration, Content } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 工具1: 读文件
const readFileTool: FunctionDeclaration = {
    name: 'read_file',
    description: '读取文件内容',
    parametersJsonSchema: {
        type: 'object',
        properties: {
            file_path: { type: 'string', description: '文件路径' }
        },
        required: ['file_path']
    }
};

// 工具2: 搜索文本
const searchTextTool: FunctionDeclaration = {
    name: 'search_text',
    description: '在文本中搜索关键词',
    parametersJsonSchema: {
        type: 'object',
        properties: {
            text: { type: 'string', description: '要搜索的文本' },
            keyword: { type: 'string', description: '搜索关键词' }
        },
        required: ['text', 'keyword']
    }
};

// 工具执行器
function executeTool(name: string | undefined, args: Record<string, unknown>) {
    if (name === 'read_file') {
        const filePath = args['file_path'] as string;
        try {
            // 注意：这里简化处理，实际应该做路径验证
            const content = readFileSync(filePath, 'utf-8');
            return { content };
        } catch (error) {
            return { error: `Failed to read file: ${error}` };
        }
    }

    if (name === 'search_text') {
        const text = args['text'] as string;
        const keyword = args['keyword'] as string;
        const lines = text.split('\n');
        const matches = lines
            .map((line, index) => ({ line: index + 1, content: line }))
            .filter(item => item.content.includes(keyword));

        return {
            found: matches.length > 0,
            matches: matches.slice(0, 5)  // 最多返回5个匹配
        };
    }

    throw new Error(`Unknown tool: ${name}`);
}

async function main() {
    const genAI = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! });

    const tools = [readFileTool, searchTextTool];
    const history: Content[] = [
        {
            role: 'user',
            parts: [{ text: '读取 package.json 启动命令' }]
        }
    ];

    const MAX_ITERATIONS = 5;  // 防止无限循环

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        console.log(`\n--- 第 ${i + 1} 轮 ---`);

        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: history,
            config: {
                tools: [{ functionDeclarations: tools }]
            }
        });

        const candidate = result.candidates?.[0];
        if (!candidate?.content?.parts) break;

        const parts = candidate.content.parts;
        history.push({ role: 'model', parts });

        // 检查是否有工具调用
        const functionCalls = parts.filter(p => p.functionCall);

        if (functionCalls.length === 0) {
            // 没有工具调用，说明AI已经生成最终答案
            console.log('AI 最终回复:');
            console.log(parts.find(p => p.text)?.text || '(无文本)');
            break;
        }

        // 执行所有工具调用
        const responses = functionCalls.map(part => {
            const fc = part.functionCall!;
            console.log(`调用工具: ${fc.name}`);
            console.log(`参数:`, fc.args);

            const result = executeTool(fc.name, fc.args as Record<string, unknown>);
            console.log(`结果:`, result);

            return {
                functionResponse: {
                    name: fc.name,
                    response: result
                }
            };
        });

        // 将所有结果添加到历史
        history.push({
            role: 'user',
            parts: responses
        });
    }
}

main().catch(console.error);