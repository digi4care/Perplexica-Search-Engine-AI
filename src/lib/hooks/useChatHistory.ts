import { useRef, useState, useEffect } from 'react';
import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

export interface ChatHistoryResult {
  messages: Message[];
  setMessages: (fn: (prev: Message[]) => Message[]) => void;
  chatHistory: React.MutableRefObject<[string, string][]>;
  messagesRef: React.MutableRefObject<Message[]>;
  files: File[];
  fileIds: string[];
  setFiles: (files: File[]) => void;
  setFileIds: (fileIds: string[]) => void;
  isMessagesLoaded: boolean;
  notFound: boolean;
}

export const useChatHistory = (
  chatId: string | undefined,
  newChatCreated: boolean,
  setSources: (sources: string[]) => void,
): ChatHistoryResult => {
  const chatHistory = useRef<[string, string][]>([]);
  const [messages, setMessagesRaw] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);

  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const prevChatIdRef = useRef<string | undefined>(chatId);

  // Detect chatId changes and reset loaded state
  useEffect(() => {
    if (chatId !== prevChatIdRef.current) {
      prevChatIdRef.current = chatId;
      setIsMessagesLoaded(false);
      setMessagesRaw([]);
      setNotFound(false);
      chatHistory.current = [];
      setFiles([]);
      setFileIds([]);
    }
  }, [chatId]);

  // Load messages when chatId is set and not yet loaded
  useEffect(() => {
    if (
      chatId &&
      !newChatCreated &&
      !isMessagesLoaded &&
      messages.length === 0
    ) {
      loadMessages(
        chatId,
        setMessagesRaw,
        setIsMessagesLoaded,
        chatHistory,
        setSources,
        setNotFound,
        setFiles,
        setFileIds,
      );
    } else if (!chatId || newChatCreated) {
      setIsMessagesLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isMessagesLoaded, newChatCreated, messages.length]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  return {
    messages,
    setMessages: setMessagesRaw as unknown as (fn: (prev: Message[]) => Message[]) => void,
    chatHistory,
    messagesRef,
    files,
    fileIds,
    setFiles,
    setFileIds,
    isMessagesLoaded,
    notFound,
  };
};

const loadMessages = async (
  chatId: string,
  setMessages: (messages: Message[]) => void,
  setIsMessagesLoaded: (loaded: boolean) => void,
  chatHistory: React.MutableRefObject<[string, string][]>,
  setSources: (sources: string[]) => void,
  setNotFound: (notFound: boolean) => void,
  setFiles: (files: File[]) => void,
  setFileIds: (fileIds: string[]) => void,
) => {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 404) {
    setNotFound(true);
    setIsMessagesLoaded(true);
    return;
  }

  const data = await res.json();

  const messages = data.messages as Message[];

  setMessages(messages);

  const history: [string, string][] = [];
  messages.forEach((msg) => {
    history.push(['human', msg.query]);

    const textBlocks = msg.responseBlocks
      .filter(
        (block): block is Block & { type: 'text' } => block.type === 'text',
      )
      .map((block) => block.data)
      .join('\n');

    if (textBlocks) {
      history.push(['assistant', textBlocks]);
    }
  });

  console.debug(new Date(), 'app:messages_loaded');

  if (messages.length > 0) {
    document.title = messages[0].query;
  }

  const files = data.chat.files.map((file: any) => {
    return {
      fileName: file.name,
      fileExtension: file.name.split('.').pop(),
      fileId: file.fileId,
    };
  });

  setFiles(files);
  setFileIds(files.map((file: File) => file.fileId));

  chatHistory.current = history;
  setSources(data.chat.sources);
  setIsMessagesLoaded(true);
};
