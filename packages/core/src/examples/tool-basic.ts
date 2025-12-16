import { GoogleGenAI } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 1. 定义工具的 Schema
const getCurrentTimeTool: FunctionDeclaration = {
    name: 'get_current_time',
    description: '获取当前的日期和时间',
    parametersJsonSchema: {       type: 'object',
        properties: {},  // 这个工具不需要参数
        required: []
    }
};

// 2. 实现工具的执行逻辑
function executeTool(functionCall: { name: string | undefined; args: Record<string, unknown> }) {
    if (functionCall.name === 'get_current_time') {
        const now = new Date();
        return {
            currentTime: now.toISOString(),
            formatted: now.toLocaleString('zh-CN')
        };
    }
    throw new Error(`Unknown tool: ${functionCall.name}`);
}

async function main() {
    const genAI = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! });

    // 3. 发送请求，并声明可用的工具
    const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: '现在几点了？' }] }
        ],
        config: {
            tools: [{
                functionDeclarations: [getCurrentTimeTool]
            }]
        }
    });

    const candidate = result.candidates?.[0];
    if (!candidate) {
        console.log('No response from AI');
        return;
    }
    console.log('AI 回复:', candidate.content)
    // 4. 检查 AI 是否调用了工具
    const firstPart = candidate.content?.parts?.[0];

    if (firstPart?.functionCall) {
        console.log('AI 决定调用工具:', firstPart.functionCall.name);
        console.log('参数:', firstPart.functionCall.args);

        // 5. 执行工具
        const toolResult = executeTool({
            name: firstPart.functionCall.name,
            args: firstPart.functionCall.args as Record<string, unknown>
        });

        console.log('工具返回:', toolResult);

        // 6. 将结果返回给 AI，让它生成最终回复
        const finalResult = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: '现在几点了？' }] },
                { role: 'model', parts: [firstPart] },  // AI 的工具调用
                {
                    role: 'user',
                    parts: [{
                        functionResponse: {
                            name: firstPart.functionCall.name,
                            response: toolResult
                        }
                    }]
                }
            ],
            config: {
                tools: [{ functionDeclarations: [getCurrentTimeTool] }]
            }
        });

        console.log('\n最终回复:');
        console.log(finalResult.candidates?.[0]?.content?.parts?.[0]?.text);

    } else if (firstPart?.text) {
        // AI 没有调用工具，直接回复了
        console.log('AI 直接回复:', firstPart.text);
    }
}

main().catch(console.error);