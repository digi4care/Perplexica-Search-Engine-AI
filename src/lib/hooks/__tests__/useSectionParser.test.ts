// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSectionParser } from '../useSectionParser';
import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';

const makeMessage = (
  overrides: Partial<Message> & { responseBlocks?: Block[] } = {},
): Message => ({
  chatId: 'chat-1',
  messageId: 'msg-1',
  backendId: 'be-1',
  query: 'test query',
  responseBlocks: overrides.responseBlocks ?? [],
  status: 'completed',
  createdAt: new Date(),
  ...overrides,
});

const textBlock = (data: string): Block => ({
  id: 'b1',
  type: 'text',
  data,
});

const sourceBlock = (sources: { metadata: { url: string } }[]): Block => ({
  id: 'b-src',
  type: 'source',
  data: sources as any,
});

const suggestionBlock = (items: string[]): Block => ({
  id: 'b-sug',
  type: 'suggestion',
  data: items,
});

const widgetBlock = (
  widgetType = 'video',
  params: Record<string, any> = {},
): Block => ({
  id: 'b-wid',
  type: 'widget',
  data: { widgetType, params },
});

describe('useSectionParser', () => {
  it('returns empty array for empty messages', () => {
    const { result } = renderHook(() => useSectionParser([]));
    expect(result.current).toEqual([]);
  });

  it('parses a simple text block', () => {
    const messages = [
      makeMessage({ responseBlocks: [textBlock('Hello world')] }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].parsedTextBlocks).toEqual(['Hello world']);
    expect(result.current[0].speechMessage).toBe('Hello world');
    expect(result.current[0].thinkingEnded).toBe(false);
    expect(result.current[0].suggestions).toEqual([]);
    expect(result.current[0].widgets).toEqual([]);
  });

  it('parses multiple text blocks into separate entries', () => {
    const messages = [
      makeMessage({
        responseBlocks: [textBlock('First'), textBlock('Second')],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current[0].parsedTextBlocks).toEqual(['First', 'Second']);
    expect(result.current[0].speechMessage).toBe('FirstSecond');
  });

  it('detects thinkingEnded when </think> tag is present', () => {
    const messages = [
      makeMessage({
        responseBlocks: [textBlock('Some thought</think>result here')],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current[0].thinkingEnded).toBe(true);
  });

  it('does not set thinkingEnded without closing think tag', () => {
    const messages = [
      makeMessage({
        responseBlocks: [textBlock('Some thought without close')],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current[0].thinkingEnded).toBe(false);
  });

  it('appends closing tag filler when unclosed <think> exists', () => {
    const messages = [
      makeMessage({
        responseBlocks: [textBlock('Thinking...<think>')],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    // Should contain the appended filler
    expect(result.current[0].parsedTextBlocks[0]).toContain('</think>');
    expect(result.current[0].parsedTextBlocks[0]).toContain('<a> </a>');
  });

  it('replaces [1] citations with <citation> links when sources exist', () => {
    const messages = [
      makeMessage({
        responseBlocks: [
          sourceBlock([{ metadata: { url: 'https://example.com' } }]),
          textBlock('Check this [1] for details'),
        ],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    const parsed = result.current[0].parsedTextBlocks[0];
    expect(parsed).toContain('<citation href="https://example.com">1</citation>');
    expect(parsed).not.toContain('[1]');
  });

  it('strips [1] when no sources exist', () => {
    const messages = [
      makeMessage({
        responseBlocks: [textBlock('No source [1] here')],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current[0].parsedTextBlocks[0]).not.toContain('[1]');
    expect(result.current[0].parsedTextBlocks[0]).toContain('No source  here');
  });

  it('handles multi-number citations like [1,2]', () => {
    const messages = [
      makeMessage({
        responseBlocks: [
          sourceBlock([
            { metadata: { url: 'https://a.com' } },
            { metadata: { url: 'https://b.com' } },
          ]),
          textBlock('See [1,2] for more'),
        ],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    const parsed = result.current[0].parsedTextBlocks[0];
    expect(parsed).toContain(
      '<citation href="https://a.com">1</citation><citation href="https://b.com">2</citation>',
    );
  });

  it('returns empty string for citations with no URL in source', () => {
    const messages = [
      makeMessage({
        responseBlocks: [
          sourceBlock([{ metadata: { url: undefined } as any }]),
          textBlock('Check [1]'),
        ],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    // Citation with no URL should be empty string (no bracket either)
    expect(result.current[0].parsedTextBlocks[0]).toBe('Check ');
  });

  it('preserves non-numeric bracket content like [text]', () => {
    const messages = [
      makeMessage({
        responseBlocks: [
          sourceBlock([{ metadata: { url: 'https://example.com' } }]),
          textBlock('See [abc] for details'),
        ],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    // Non-numeric should be preserved as-is since parseInt returns NaN
    expect(result.current[0].parsedTextBlocks[0]).toContain('[abc]');
  });

  it('extracts suggestions from suggestion blocks', () => {
    const messages = [
      makeMessage({
        responseBlocks: [
          textBlock('Answer'),
          suggestionBlock(['Try this', 'Or that']),
        ],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current[0].suggestions).toEqual(['Try this', 'Or that']);
  });

  it('extracts widgets from widget blocks', () => {
    const messages = [
      makeMessage({
        responseBlocks: [
          widgetBlock('video', { query: 'test' }),
          widgetBlock('image', { query: 'photo' }),
        ],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current[0].widgets).toHaveLength(2);
    expect(result.current[0].widgets[0].widgetType).toBe('video');
    expect(result.current[0].widgets[1].widgetType).toBe('image');
  });

  it('builds speechMessage without citation numbers', () => {
    const messages = [
      makeMessage({
        responseBlocks: [
          sourceBlock([{ metadata: { url: 'https://example.com' } }]),
          textBlock('Result [1] is great'),
        ],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current[0].speechMessage).toBe('Result  is great');
  });

  it('handles multiple messages', () => {
    const messages = [
      makeMessage({
        messageId: 'm1',
        responseBlocks: [textBlock('First answer')],
      }),
      makeMessage({
        messageId: 'm2',
        responseBlocks: [textBlock('Second answer')],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current).toHaveLength(2);
    expect(result.current[0].parsedTextBlocks[0]).toBe('First answer');
    expect(result.current[1].parsedTextBlocks[0]).toBe('Second answer');
  });

  it('preserves message reference in section', () => {
    const msg = makeMessage({ responseBlocks: [textBlock('Test')] });
    const { result } = renderHook(() => useSectionParser([msg]));
    expect(result.current[0].message).toBe(msg);
  });

  it('ignores block types other than text/source/suggestion/widget', () => {
    const researchBlock: Block = {
      id: 'b-res',
      type: 'research',
      data: { subSteps: [] },
    };
    const messages = [
      makeMessage({ responseBlocks: [researchBlock, textBlock('Text')] }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    expect(result.current[0].parsedTextBlocks).toEqual(['Text']);
    expect(result.current[0].widgets).toEqual([]);
  });

  it('handles edge case: zero in citation [0]', () => {
    const messages = [
      makeMessage({
        responseBlocks: [
          sourceBlock([{ metadata: { url: 'https://example.com' } }]),
          textBlock('Ref [0]'),
        ],
      }),
    ];
    const { result } = renderHook(() => useSectionParser(messages));
    // 0 <= 0, so it should return the bracket form `[0]`
    expect(result.current[0].parsedTextBlocks[0]).toContain('[0]');
  });
});
