
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error('Missing API Key');

    const genAI = new GoogleGenAI({ apiKey });

    console.log('正在思考: "写一首关于程序员的五言绝句"...');

    const result = await genAI.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: '写一首关于程序员的五言绝句' }] }]
    });


    for await (const chunk of result) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            process.stdout.write(text);
        }
    }
    console.log('\n\n完成!');
}

main().catch(console.error);
