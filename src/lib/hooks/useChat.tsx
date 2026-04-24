'use client';

import { Message } from '@/components/ChatWindow';
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import crypto from 'crypto';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useChatConfig } from './useChatConfig';
import type { ChatModelProvider, EmbeddingModelProvider } from './useChatConfig';
import { useChatStream } from './useChatStream';
import { useChatHistory } from './useChatHistory';
import { useSectionParser } from './useSectionParser';

export type { Section } from './useSectionParser';
import type { Section } from './useSectionParser';

type ChatContext = {
  messages: Message[];
  sections: Section[];
  chatHistory: [string, string][];
  files: File[];
  fileIds: string[];
  sources: string[];
  chatId: string | undefined;
  optimizationMode: string;
  isMessagesLoaded: boolean;
  loading: boolean;
  notFound: boolean;
  messageAppeared: boolean;
  isReady: boolean;
  hasError: boolean;
  chatModelProvider: ChatModelProvider;
  embeddingModelProvider: EmbeddingModelProvider;
  researchEnded: boolean;
  setResearchEnded: (ended: boolean) => void;
  setOptimizationMode: (mode: string) => void;
  setSources: (sources: string[]) => void;
  setFiles: (files: File[]) => void;
  setFileIds: (fileIds: string[]) => void;
  sendMessage: (
    message: string,
    messageId?: string,
    rewrite?: boolean,
  ) => Promise<void>;
  rewrite: (messageId: string) => void;
  setChatModelProvider: (provider: ChatModelProvider) => void;
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void;
};

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

export const chatContext = createContext<ChatContext>({
  chatHistory: [],
  chatId: '',
  fileIds: [],
  files: [],
  sources: [],
  hasError: false,
  isMessagesLoaded: false,
  isReady: false,
  loading: false,
  messageAppeared: false,
  messages: [],
  sections: [],
  notFound: false,
  optimizationMode: '',
  chatModelProvider: { key: '', providerId: '' },
  embeddingModelProvider: { key: '', providerId: '' },
  researchEnded: false,
  rewrite: () => {},
  sendMessage: async () => {},
  setFileIds: () => {},
  setFiles: () => {},
  setSources: () => {},
  setOptimizationMode: () => {},
  setChatModelProvider: () => {},
  setEmbeddingModelProvider: () => {},
  setResearchEnded: () => {},
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const params: { chatId: string } = useParams();
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q');

  const [chatId, setChatId] = useState<string | undefined>(params.chatId);
  const [newChatCreated, setNewChatCreated] = useState(false);
  const [sources, setSources] = useState<string[]>(['web']);
  const [optimizationMode, setOptimizationMode] = useState('speed');
  const [isReady, setIsReady] = useState(false);

  const config = useChatConfig();
  const history = useChatHistory(chatId, newChatCreated, setSources);
  const sections = useSectionParser(history.messages);
  const stream = useChatStream({
    chatId,
    messages: history.messages,
    setMessages: history.setMessages,
    chatHistory: history.chatHistory,
    messagesRef: history.messagesRef,
    fileIds: history.fileIds,
    sources,
    optimizationMode,
    chatModelProvider: config.chatModelProvider,
    embeddingModelProvider: config.embeddingModelProvider,
  });

  // Handle new chat (no chatId yet)
  useEffect(() => {
    if (!chatId) {
      setNewChatCreated(true);
      setChatId(crypto.randomBytes(20).toString('hex'));
    }
     
  }, [chatId]);

  // Ready state + reconnect logic
  useEffect(() => {
    if (history.isMessagesLoaded && config.isConfigReady && newChatCreated) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
    } else if (history.isMessagesLoaded && config.isConfigReady && !newChatCreated) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
      stream.checkReconnect();
    } else {
      setIsReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.isMessagesLoaded, config.isConfigReady, newChatCreated]);

  // Send initial message from URL query param
  useEffect(() => {
    if (isReady && initialMessage && config.isConfigReady) {
      if (!config.isConfigReady) {
        toast.error('Cannot send message before the configuration is ready');
        return;
      }
      stream.sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.isConfigReady, isReady, initialMessage]);

  return (
    <chatContext.Provider
      value={{
        messages: history.messages,
        sections,
        chatHistory: history.chatHistory.current,
        files: history.files,
        fileIds: history.fileIds,
        sources,
        chatId,
        hasError: config.hasError,
        isMessagesLoaded: history.isMessagesLoaded,
        isReady,
        loading: stream.loading,
        messageAppeared: stream.messageAppeared,
        notFound: history.notFound,
        optimizationMode,
        setFileIds: history.setFileIds,
        setFiles: history.setFiles,
        setSources,
        setOptimizationMode,
        rewrite: stream.rewrite,
        sendMessage: stream.sendMessage,
        setChatModelProvider: config.setChatModelProvider,
        chatModelProvider: config.chatModelProvider,
        embeddingModelProvider: config.embeddingModelProvider,
        setEmbeddingModelProvider: config.setEmbeddingModelProvider,
        researchEnded: stream.researchEnded,
        setResearchEnded: stream.setResearchEnded,
      }}
    >
      {children}
    </chatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(chatContext);
  return ctx;
};
