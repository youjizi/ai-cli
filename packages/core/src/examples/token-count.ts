import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const genAI = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! });

    const text = "你好，Gemini。这是一个测试 Token 数量的句子。";

    // 1. 计算文本的 Token
    const countResult = await genAI.models.countTokens({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text }] }]
    });

    console.log(`文本: "${text}"`);
    console.log(`Token 数量: ${countResult.totalTokens}`);

    // 2. 模拟一个较长的历史记录
    const longHistory = [
        { role: 'user', parts: [{ text: '我的代码为什么报错了？' }] },
        { role: 'model', parts: [{ text: '请提供错误日志。' }] },
        { role: 'user', parts: [{ text: 'Error: NullPointerException at ... (此处省略1000字)' }] }
    ];

    // 计算历史记录的总 Token
    const historyCount = await genAI.models.countTokens({
        model: 'gemini-2.0-flash',
        contents: longHistory
    });

    console.log(`\n历史记录总 Token: ${historyCount.totalTokens}`);
    console.log(`\n缓存 Token: ${historyCount.cachedContentTokenCount}`);

    const historyCount2 = await genAI.models.countTokens({
        model: 'gemini-2.0-flash',
        contents: longHistory
    });

    console.log(`\n历史记录总 Token: ${historyCount2.totalTokens}`);
    console.log(`\n缓存 Token: ${historyCount2.cachedContentTokenCount}`);
}

main().catch(console.error);
