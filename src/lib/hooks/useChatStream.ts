import { useRef, useState, useCallback } from 'react';
import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';
import { getAutoMediaSearch } from '../config/clientRegistry';
import { applyPatch } from 'rfc6902';
import crypto from 'crypto';
import type {
  ChatModelProvider,
  EmbeddingModelProvider,
} from './useChatConfig';
import type { File } from './useChatHistory';

export interface ChatStreamDeps {
  chatId: string | undefined;
  messages: Message[];
  setMessages: (fn: (prev: Message[]) => Message[]) => void;
  chatHistory: React.MutableRefObject<[string, string][]>;
  messagesRef: React.MutableRefObject<Message[]>;
  fileIds: string[];
  sources: string[];
  optimizationMode: string;
  chatModelProvider: ChatModelProvider;
  embeddingModelProvider: EmbeddingModelProvider;
}

export interface ChatStreamResult {
  loading: boolean;
  messageAppeared: boolean;
  researchEnded: boolean;
  setResearchEnded: (ended: boolean) => void;
  sendMessage: (
    message: string,
    messageId?: string,
    rewrite?: boolean,
  ) => Promise<void>;
  rewrite: (messageId: string) => void;
  checkReconnect: () => Promise<void>;
}

export const useChatStream = (deps: ChatStreamDeps): ChatStreamResult => {
  const {
    chatId,
    messages,
    setMessages,
    chatHistory,
    messagesRef,
    fileIds,
    sources,
    optimizationMode,
    chatModelProvider,
    embeddingModelProvider,
  } = deps;

  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);
  const [researchEnded, setResearchEnded] = useState(false);

  const isReconnectingRef = useRef(false);
  const handledMessageEndRef = useRef<Set<string>>(new Set());

  const getMessageHandler = useCallback(
    (message: Message) => {
      const messageId = message.messageId;

      return async (data: any) => {
        if (data.type === 'error') {
          toast.error(data.data);
          setLoading(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === messageId
                ? { ...msg, status: 'error' as const }
                : msg,
            ),
          );
          return;
        }

        if (data.type === 'researchComplete') {
          setResearchEnded(true);
          if (
            message.responseBlocks.find(
              (b) => b.type === 'source' && b.data.length > 0,
            )
          ) {
            setMessageAppeared(true);
          }
        }

        if (data.type === 'block') {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.messageId === messageId) {
                const exists = msg.responseBlocks.findIndex(
                  (b) => b.id === data.block.id,
                );

                if (exists !== -1) {
                  const existingBlocks = [...msg.responseBlocks];
                  existingBlocks[exists] = data.block;

                  return {
                    ...msg,
                    responseBlocks: existingBlocks,
                  };
                }

                return {
                  ...msg,
                  responseBlocks: [...msg.responseBlocks, data.block],
                };
              }
              return msg;
            }),
          );

          if (
            (data.block.type === 'source' && data.block.data.length > 0) ||
            data.block.type === 'text'
          ) {
            setMessageAppeared(true);
          }
        }

        if (data.type === 'updateBlock') {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.messageId === messageId) {
                const updatedBlocks = msg.responseBlocks.map((block) => {
                  if (block.id === data.blockId) {
                    const updatedBlock = { ...block };
                    applyPatch(updatedBlock, data.patch);
                    return updatedBlock;
                  }
                  return block;
                });
                return { ...msg, responseBlocks: updatedBlocks };
              }
              return msg;
            }),
          );
        }

        if (data.type === 'messageEnd') {
          if (handledMessageEndRef.current.has(messageId)) {
            return;
          }

          handledMessageEndRef.current.add(messageId);

          const currentMsg = messagesRef.current.find(
            (msg) => msg.messageId === messageId,
          );

          const newHistory: [string, string][] = [
            ...chatHistory.current,
            ['human', message.query],
            [
              'assistant',
              currentMsg?.responseBlocks.find((b) => b.type === 'text')
                ?.data || '',
            ],
          ];

          chatHistory.current = newHistory;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === messageId
                ? { ...msg, status: 'completed' as const }
                : msg,
            ),
          );

          setLoading(false);

          const lastMsg = messagesRef.current[messagesRef.current.length - 1];

          const autoMediaSearch = getAutoMediaSearch();

          if (autoMediaSearch) {
            setTimeout(() => {
              document
                .getElementById(`search-images-${lastMsg.messageId}`)
                ?.click();

              document
                .getElementById(`search-videos-${lastMsg.messageId}`)
                ?.click();
            }, 200);
          }

          const hasSourceBlocks = currentMsg?.responseBlocks.some(
            (block) => block.type === 'source' && block.data.length > 0,
          );
          const hasSuggestions = currentMsg?.responseBlocks.some(
            (block) => block.type === 'suggestion',
          );

          if (hasSourceBlocks && !hasSuggestions) {
            const suggestions = await getSuggestions(newHistory);
            const suggestionBlock: Block = {
              id: crypto.randomBytes(7).toString('hex'),
              type: 'suggestion',
              data: suggestions,
            };

            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.messageId === messageId) {
                  return {
                    ...msg,
                    responseBlocks: [...msg.responseBlocks, suggestionBlock],
                  };
                }
                return msg;
              }),
            );
          }
        }
      };
    },
    [chatHistory, messagesRef, setMessages],
  );

  const checkReconnect = useCallback(async () => {
    if (isReconnectingRef.current) return;

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];

      if (lastMsg.status === 'answering') {
        setLoading(true);
        setResearchEnded(false);
        setMessageAppeared(false);

        isReconnectingRef.current = true;

        const res = await fetch(`/api/reconnect/${lastMsg.backendId}`, {
          method: 'POST',
        });

        if (!res.body) throw new Error('No response body');

        const reader = res.body?.getReader();
        const decoder = new TextDecoder('utf-8');

        let partialChunk = '';

        const messageHandler = getMessageHandler(lastMsg);

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            partialChunk += decoder.decode(value, { stream: true });

            try {
              const messages = partialChunk.split('\n');
              for (const msg of messages) {
                if (!msg.trim()) continue;
                const json = JSON.parse(msg);
                messageHandler(json);
              }
              partialChunk = '';
            } catch (error) {
              console.warn('Incomplete JSON, waiting for next chunk...');
            }
          }
        } finally {
          isReconnectingRef.current = false;
        }
      }
    }
  }, [messages, getMessageHandler]);

  const sendMessage: ChatStreamResult['sendMessage'] = useCallback(
    async (message, messageId, rewrite = false) => {
      if (loading || !message) return;
      setLoading(true);
      setResearchEnded(false);
      setMessageAppeared(false);

      if (messages.length <= 1) {
        window.history.replaceState(null, '', `/c/${chatId}`);
      }

      messageId = messageId ?? crypto.randomBytes(7).toString('hex');
      const backendId = crypto.randomBytes(20).toString('hex');

      const newMessage: Message = {
        messageId,
        chatId: chatId!,
        backendId,
        query: message,
        responseBlocks: [],
        status: 'answering',
        createdAt: new Date(),
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);

      const messageIndex = messages.findIndex((m) => m.messageId === messageId);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          message: {
            messageId: messageId,
            chatId: chatId!,
            content: message,
          },
          chatId: chatId!,
          files: fileIds,
          sources: sources,
          optimizationMode: optimizationMode,
          history: rewrite
            ? chatHistory.current.slice(
                0,
                messageIndex === -1 ? undefined : messageIndex,
              )
            : chatHistory.current,
          chatModel: {
            key: chatModelProvider.key,
            providerId: chatModelProvider.providerId,
          },
          embeddingModel: {
            key: embeddingModelProvider.key,
            providerId: embeddingModelProvider.providerId,
          },
          systemInstructions: localStorage.getItem('systemInstructions'),
        }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      let partialChunk = '';

      const messageHandler = getMessageHandler(newMessage);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        partialChunk += decoder.decode(value, { stream: true });

        try {
          const messages = partialChunk.split('\n');
          for (const msg of messages) {
            if (!msg.trim()) continue;
            const json = JSON.parse(msg);
            messageHandler(json);
          }
          partialChunk = '';
        } catch (error) {
          console.warn('Incomplete JSON, waiting for next chunk...');
        }
      }
    },
    [
      loading,
      chatId,
      messages,
      setMessages,
      fileIds,
      sources,
      optimizationMode,
      chatHistory,
      chatModelProvider,
      embeddingModelProvider,
      getMessageHandler,
    ],
  );

  const rewrite = useCallback(
    (messageId: string) => {
      const index = messages.findIndex((msg) => msg.messageId === messageId);

      if (index === -1) return;

      setMessages((prev) => prev.slice(0, index));

      chatHistory.current = chatHistory.current.slice(0, index * 2);

      const messageToRewrite = messages[index];
      sendMessage(messageToRewrite.query, messageToRewrite.messageId, true);
    },
    [messages, setMessages, chatHistory, sendMessage],
  );

  return {
    loading,
    messageAppeared,
    researchEnded,
    setResearchEnded,
    sendMessage,
    rewrite,
    checkReconnect,
  };
};
