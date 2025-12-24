import type {LLMAdapter} from "../../adapter.js";
import type {GenerateContentResponse, GoogleGenAI} from "@google/genai";

import {fromGeminiResponse, toGeminiContents, toGeminiTools} from "./converter.js";
import {AdapterError} from "../../errors.js";
import type {GenerateRequest, GenerateResponse, Message} from "../../types.js";
import type {StreamEvent} from "../../stream.js";
import {processGeminiStream} from "./stream-processor.js";


export class GeminiAdapter implements LLMAdapter {

    readonly providerId = 'gemini';

    readonly capabilities = {
        streaming: true,
        toolCalls: true,
        vision: true,
        systemMessage: true,
    };

    constructor(private client: GoogleGenAI) {}

    async generate(request: GenerateRequest): Promise<GenerateResponse>{
        try {
            const contents = toGeminiContents(request.messages);
            const tools = request.tools ? toGeminiTools(request.tools) : undefined;

            const result: GenerateContentResponse = await this.client.models.generateContent({
                model: request.model,  // 使用默认模型
                contents,
                config: {
                    systemInstruction: request.system,
                    tools,
                    temperature: request.temperature,
                    maxOutputTokens: request.maxTokens,
                    topP: request.topP,
                }
            });
            return fromGeminiResponse(result);
        } catch (error){
            throw new AdapterError(`Gemini generate failed: ${error}`, this.providerId, error);
        }



    };



    async *generateStream(request: GenerateRequest): AsyncGenerator<StreamEvent>{
        try {
            // 1.转换参数
            const contents = toGeminiContents(request.messages);
            const tools = request.tools ? toGeminiTools(request.tools) : undefined;

            // 2.调用gemini
            const stream = await this.client.models.generateContentStream({
                model: request.model,  // 使用默认模型
                contents,
                config: {
                    systemInstruction: request.system,
                    tools,
                    temperature: request.temperature,
                    maxOutputTokens: request.maxTokens,
                    topP: request.topP,
                    stopSequences: request.stopSequences
                }
            });
            // 3.处理流式
            yield* processGeminiStream(stream);
        } catch (error){
            throw new AdapterError(`Gemini stream failed: ${error}`, this.providerId, error);
        }


    };


    /**
     * 计算 token 数
     */
    async countTokens(messages: Message[]): Promise<number> {
        try {
            const contents = toGeminiContents(messages);
            const result = await this.client.models.countTokens({
                model: 'gemini-2.5-flash',  // 使用默认模型
                contents,
            });
            return result.totalTokens ?? 0;
        } catch (error) {
            throw new AdapterError(`Gemini countTokens failed: ${error}`, this.providerId, error);
        }
    }

}

