
import { GoogleGenAI } from '@google/genai';
import type { Content } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error('Missing API Key');

    const genAI = new GoogleGenAI({ apiKey });

    const history: Content[] = [
        {
            role: 'user',
            parts: [{ text: '你是一名可爱的人类幼童，说话很萌很萌。' }],
        },
        {
            role: 'user',
            parts: [{ text: '你好，我叫 Antigravity。' }],
        },
        {
            role: 'model',
            parts: [{ text: '哇哦，好酷的名字，大哥哥' }],
        },
    ];

    const userMessage = '你也很可爱，会跳舞吗？';
    console.log(`User: ${userMessage}`);

    history.push({ role: 'user', parts: [{ text: userMessage }] });

    const result = await genAI.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: history,
        config: {
            maxOutputTokens: 200,
            temperature: 0.7
        }
    });

    process.stdout.write('Gemini: ');
    let responseText = '';

    for await (const chunk of result) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            process.stdout.write(text);
            responseText += text;
        }
    }
    console.log('\n');
}

main().catch(console.error);
