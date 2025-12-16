import { GoogleGenAI } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 定义一个计算器工具
const calculatorTool: FunctionDeclaration = {
    name: 'calculator',
    description: '执行数学运算（加减乘除）',
    parametersJsonSchema: {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                description: '运算类型',
                enum: ['add', 'subtract', 'multiply', 'divide']
            },
            a: {
                type: 'number',
                description: '第一个数字'
            },
            b: {
                type: 'number',
                description: '第二个数字'
            }
        },
        required: ['operation', 'a', 'b']
    }
};

function calculate(operation: string, a: number, b: number): number {
    switch (operation) {
        case 'add': return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide':
            if (b === 0) throw new Error('Division by zero');
            return a / b;
        default: throw new Error(`Unknown operation: ${operation}`);
    }
}

async function main() {
    const genAI = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! });

    const userQuestion = '如果我有 15 个苹果，分给 3 个人，每人能分到几个？';
    console.log(`用户: ${userQuestion}\n`);

    const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: userQuestion }] }],
        config: {
            tools: [{ functionDeclarations: [calculatorTool] }]
        }
    });

    const functionCall = result.candidates?.[0]?.content?.parts?.[0]?.functionCall;

    if (functionCall) {
        const args = functionCall.args as { operation: string; a: number; b: number };
        console.log(`AI 调用工具: ${functionCall.name}`);
        console.log(`参数: operation=${args.operation}, a=${args.a}, b=${args.b}\n`);

        const calcResult = calculate(args.operation, args.a, args.b);
        console.log(`计算结果: ${calcResult}\n`);

        // 返回结果给 AI
        const finalResponse = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: userQuestion }] },
                { role: 'model', parts: [result.candidates![0].content!.parts![0]] },
                {
                    role: 'user',
                    parts: [{
                        functionResponse: {
                            name: functionCall.name,
                            response: { result: calcResult }
                        }
                    }]
                }
            ],
            config: {
                tools: [{ functionDeclarations: [calculatorTool] }]
            }
        });

        console.log('AI 最终回复:');
        console.log(finalResponse.candidates?.[0]?.content?.parts?.[0]?.text);
    }
}

main().catch(console.error);