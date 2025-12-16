import { GoogleGenAI } from '@google/genai';
import type { Content } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const genAI = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! });

const MAX_TOKENS = 60;

async function pruneHistory(history: Content[]): Promise<Content[]> {
    const countResult = await genAI.models.countTokens({
        model: 'gemini-2.0-flash',
        contents: history
    });

    let currentTokens = countResult.totalTokens ?? 0;

    if (currentTokens <= MAX_TOKENS) {
        return history;
    }

    console.log(`⚠️ 当前 Token (${currentTokens}) 超过限制 (${MAX_TOKENS})，开始裁剪...`);

    const newHistory = [...history];

    while (currentTokens > MAX_TOKENS && newHistory.length > 1) {
        newHistory.shift();
        if (newHistory.length > 0 && newHistory[0].role === 'model') {
            newHistory.shift();
        }

        const newCountResult = await genAI.models.countTokens({
            model: 'gemini-2.0-flash',
            contents: newHistory
        });

        currentTokens = newCountResult.totalTokens ?? 0;
        console.log(`  - 裁剪后剩余 Token: ${currentTokens}`);
    }

    return newHistory;
}

async function main() {
    let history: Content[] = [
        { role: 'user', parts: [{ text: '第一句话。' }] },
        { role: 'model', parts: [{ text: '这是第一句的回答。' }] },
        { role: 'model', parts: [{ text: '这是第一句的回答。' }] },
        { role: 'model', parts: [{ text: 'The future of AI agents is one where models work seamlessly across hundreds or thousands of tools. An IDE assistant that integrates git operations, file manipulation, package managers, testing frameworks, and deployment pipelines. An operations coordinator that connects Slack, GitHub, Google Drive, Jira, company databases, and dozens of MCP servers simultaneously.\n' +
                    '\n' +
                    'To build effective agents, they need to work with unlimited tool libraries without stuffing every definition into context upfront. Our blog article on using code execution with MCP discussed how tool results and definitions can sometimes consume 50,000+ tokens before an agent reads a request. Agents should discover and load tools on-demand, keeping only what\'s relevant for the current task.\n' +
                    '\n' +
                    'Agents also need the ability to call tools from code. When using natural language tool calling, each invocation requires a full inference pass, and intermediate results pile up in context whether they\'re useful or not. Code is a natural fit for orchestration logic, such as loops, conditionals, and data transformations. Agents need the flexibility to choose between code execution and inference based on the task at hand.\n' +
                    '\n' +
                    'Agents also need to learn correct tool usage from examples, not just schema definitions. JSON schemas define what\'s structurally valid, but can\'t express usage patterns: when to include optional parameters, which combinations make sense, or what conventions your API expects.\n' +
                    '\n' +
                    'Today, we\'re releasing three features that make this possible:\n' +
                    '\n' +
                    'Tool Search Tool, which allows Claude to use search tools to access thousands of tools without consuming its context window\n' +
                    'Programmatic Tool Calling, which allows Claude to invoke tools in a code execution environment reducing the impact on the model’s context window\n' +
                    'Tool Use Examples, which provides a universal standard for demonstrating how to effectively use a given tool\n' +
                    'In internal testing, we’ve found these features have helped us build thing。' }] },
        { role: 'model', parts: [{ text: 'Today, we\'re releasing three features that make this possible:。' }] },
        { role: 'user', parts: [{ text: '第三句话，非常非常长，用来触发裁剪机制。1234567890' }] },
    ];

    console.log('--- 裁剪前 ---');
    console.log(`消息条数: ${history.length}`);

    history = await pruneHistory(history);

    console.log('\n--- 裁剪后 ---');
    console.log(`消息条数: ${history.length}`);
    console.log('剩余内容:', JSON.stringify(history, null, 2));
}

main().catch(console.error);
