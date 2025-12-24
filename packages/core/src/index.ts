import {GeminiAdapter, type Message, registry} from "./llm/index.js";
import {GoogleGenAI} from "@google/genai";

async function main() {
    // 1. 创建并注册适配器
    const client = new GoogleGenAI({apiKey: 'AIzaSyA6_oSrhJGePYOap2NC0w7p3FBcJrvZ_nI'});
    const gemini = new GeminiAdapter(client);
    registry.register(gemini);

    // 2.获取模型
    const geminiModel = registry.get('gemini');

    const messages: Message[] = [
        {role: 'user', content: [{type: 'text', text: '你好，你在什么名字，可以跟我说你的经历吗？'}]}
    ];

    const stream = geminiModel.generateStream({
        model: 'gemini-2.5-flash',
        messages,
        system: '你是一个ISFP的人类'
    });


    for await (const event of stream) {
        console.log(event.type);
        // if (event.type === 'text_delta') {
        //     process.stdout.write(event.text);
        // } else if (event.type === 'tool_call') {
        //     console.log(`\n[Tool Call] ${event.name}`);
        // } else if (event.type === 'done') {
        //     console.log(`\n[Done] ${event.finishReason}`);
        // }
    }
}

main().catch((error) => console.error(error))