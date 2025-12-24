import type { GenerateContentResponse } from '@google/genai';
import type { StreamEvent } from '../../stream.js';
import type { FinishReason } from '../../types.js';


export async function* processGeminiStream(
    stream: AsyncIterable<GenerateContentResponse>
): AsyncGenerator<StreamEvent> {
        let finishReason: FinishReason = 'stop'
    let usage = undefined;

    for await (const chunk of stream) {
        // 第0个 是content体
        const candidate = chunk.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];

        for (const part of parts) {
            if ('text' in part && part.text) {
                yield {
                    type: 'text_delta',
                    text: part.text,
                };
            }

            if ('functionCall' in part && part.functionCall) {
                yield {
                    type: 'tool_call',
                    id: part.functionCall.id || '',
                    name: part.functionCall.name || '',
                    arguments: JSON.stringify(part.functionCall.args),
                };
            }
        }
        if (candidate?.finishReason === 'STOP') {
            finishReason = 'stop';
        }
        if (candidate?.finishReason === 'MAX_TOKENS') {
            finishReason = 'length';
        }
        // 更新使用量
        if (chunk.usageMetadata) {
            usage = {
                promptTokens: chunk.usageMetadata.promptTokenCount ?? 0,
                completionTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
                totalTokens: chunk.usageMetadata.totalTokenCount ?? 0,
            };
        }
        // 最后发送完成事件
        yield {
            type: 'done',
            finishReason,
            usage,
        };
    }


}