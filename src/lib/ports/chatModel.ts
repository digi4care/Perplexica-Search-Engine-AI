import type z from 'zod';
import type { Message } from '../types';
import type { GenerateOptions, Tool, StreamTextOutput, GenerateObjectInput } from '../models/types';

/**
 * Port interface for LLM chat model operations.
 *
 * Wraps the subset of BaseLLM methods actually used by the search pipeline:
 * - generateObject: classifier, picker/extractor, widget agents
 * - streamText: writer, researcher agent loop
 *
 * The method signatures match BaseLLM<CONFIG> exactly so that any BaseLLM
 * instance satisfies this interface without an adapter class (structural typing).
 */
export interface ChatModel {
  /**
   * Generate a structured object matching the given Zod schema.
   * Used by classifier, search result picker, widget agents.
   */
  generateObject<T>(input: GenerateObjectInput): Promise<z.infer<T>>;

  /**
   * Stream text output, optionally with tool calling.
   * Used by writer (no tools) and researcher (with tools).
   *
   * Returns an AsyncGenerator — consumer iterates with `for await...of`.
   */
  streamText(input: {
    messages: Message[];
    tools?: Tool[];
    options?: GenerateOptions;
  }): AsyncGenerator<StreamTextOutput>;
}
