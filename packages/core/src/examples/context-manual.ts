import { GoogleGenAI } from '@google/genai';
import type { Content } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const genAI = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! });

const history: Content[] = [];

async function chat(message: string) {
    const userContent: Content = { role: 'user', parts: [{ text: message }] };
    history.push(userContent);

    console.log(`User: ${message}`);

    const result = await genAI.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: history,
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

    history.push({ role: 'model', parts: [{ text: responseText }] });
}

async function main() {
    await chat("你好，我有一个苹果。");
    await chat("我又买了一个香蕉。");
    await chat("我现在有什么水果？");
}

main().catch(console.error);
