import z from 'zod';
import { generateText, streamText, generateObject, streamObject } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import { zodSchema } from '@ai-sdk/provider-utils';
import BaseLLM from '../base/llm';
import type {
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  GenerateObjectInput,
  Tool,
} from '../types';
import type { Message } from '@/lib/types';

type SdkLLMConfig = { model: LanguageModel };

function convertMessages(messages: Message[]): ModelMessage[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'user':
        return { role: 'user' as const, content: msg.content };
      case 'system':
        return { role: 'system' as const, content: msg.content };
      case 'assistant':
        return {
          role: 'assistant' as const,
          content: msg.tool_calls?.length
            ? [
                ...(msg.content
                  ? [{ type: 'text' as const, text: msg.content }]
                  : []),
                ...msg.tool_calls.map((tc) => ({
                  type: 'tool-call' as const,
                  toolCallId: tc.id,
                  toolName: tc.name,
                  input: tc.arguments,
                })),
              ]
            : msg.content,
        };
      case 'tool':
        return {
          role: 'tool' as const,
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: msg.id,
              toolName: msg.name,
              output: { type: 'text' as const, value: msg.content },
            },
          ],
        };
    }
  });
}

function convertTools(tools: Tool[]) {
  return Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      {
        description: tool.description,
        inputSchema: zodSchema(tool.schema),
      },
    ]),
  );
}

class SdkLLM extends BaseLLM<SdkLLMConfig> {
  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const sdkTools = input.tools?.length ? convertTools(input.tools) : undefined;

    const { text, toolCalls: sdkToolCalls, finishReason } = await generateText({
      model: this.config.model,
      messages: convertMessages(input.messages),
      tools: sdkTools,
      temperature: input.options?.temperature,
      maxOutputTokens: input.options?.maxTokens,
      topP: input.options?.topP,
      stopSequences: input.options?.stopSequences,
      frequencyPenalty: input.options?.frequencyPenalty,
      presencePenalty: input.options?.presencePenalty,
    });

    return {
      content: text,
      toolCalls: sdkToolCalls.map((tc) => ({
        id: tc.toolCallId,
        name: tc.toolName,
        arguments: tc.input as Record<string, unknown>,
      })),
      additionalInfo: { finishReason },
    };
  }

  async *streamText(input: GenerateTextInput): AsyncGenerator<StreamTextOutput> {
    const sdkTools = input.tools?.length ? convertTools(input.tools) : undefined;

    const result = streamText({
      model: this.config.model,
      messages: convertMessages(input.messages),
      tools: sdkTools,
      temperature: input.options?.temperature,
      maxOutputTokens: input.options?.maxTokens,
      topP: input.options?.topP,
      stopSequences: input.options?.stopSequences,
      frequencyPenalty: input.options?.frequencyPenalty,
      presencePenalty: input.options?.presencePenalty,
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          yield {
            contentChunk: part.text,
            toolCallChunk: [],
            additionalInfo: {},
          };
          break;
        case 'tool-call':
          yield {
            contentChunk: '',
            toolCallChunk: [
              {
                id: part.toolCallId,
                name: part.toolName,
                arguments: part.input as Record<string, unknown>,
              },
            ],
            additionalInfo: {},
          };
          break;
        case 'finish-step':
          yield {
            contentChunk: '',
            toolCallChunk: [],
            additionalInfo: { finishReason: part.finishReason },
            done: true,
          };
          break;
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<z.infer<T>> {
    const { object } = await generateObject({
      model: this.config.model,
      schema: zodSchema(input.schema),
      messages: convertMessages(input.messages),
      temperature: input.options?.temperature,
      maxOutputTokens: input.options?.maxTokens,
      topP: input.options?.topP,
      frequencyPenalty: input.options?.frequencyPenalty,
      presencePenalty: input.options?.presencePenalty,
    });

    return object as z.infer<T>;
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<Partial<z.infer<T>>> {
    const result = streamObject({
      model: this.config.model,
      schema: zodSchema(input.schema),
      messages: convertMessages(input.messages),
      temperature: input.options?.temperature,
      maxOutputTokens: input.options?.maxTokens,
      topP: input.options?.topP,
      frequencyPenalty: input.options?.frequencyPenalty,
      presencePenalty: input.options?.presencePenalty,
    });

    for await (const partialObject of result.partialObjectStream) {
      yield partialObject as Partial<z.infer<T>>;
    }
  }
}

export default SdkLLM;
