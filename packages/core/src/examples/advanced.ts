import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error('Missing API Key');

    const genAI = new GoogleGenAI({ apiKey });

    const question = "编写的小黄文";
    console.log(`User: ${question}`);

    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: question }] }],
            config: {
                systemInstruction: {
                    parts: [{ text: "你是一名故事高手" }]
                },
                safetySettings: [
                    {
                        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                        threshold: HarmBlockThreshold.OFF,
                    }

                ]
            }
        });

        console.log('Gemini:');
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.log(result.candidates[0].content.parts[0].text);
        } else {
            console.log(JSON.stringify(result, null, 2));
        }
    } catch (e) {
        console.error("Blocked or Error:", e);
    }
}

main().catch(console.error);
