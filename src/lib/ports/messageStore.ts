import type { Block } from '../types';

/**
 * Represents a persisted message record from the database.
 * Fields match the Drizzle schema in src/lib/db/schema.ts.
 */
export interface MessageRecord {
  id: number;
  messageId: string;
  chatId: string;
  backendId: string;
  query: string;
  createdAt: string;
  responseBlocks: Block[];
  status: 'answering' | 'completed' | 'error';
}

/**
 * Port interface for message persistence.
 *
 * Abstracts the Drizzle ORM operations on the messages table.
 * Used by SearchAgent to check, create, and update message records
 * during search orchestration.
 */
export interface MessageStore {
  /** Find a message by chatId and messageId. */
  findMessage(params: {
    chatId: string;
    messageId: string;
  }): Promise<MessageRecord | undefined>;

  /** Insert a new message record. */
  insertMessage(params: {
    chatId: string;
    messageId: string;
    backendId: string;
    query: string;
    createdAt: string;
    status: 'answering';
    responseBlocks: Block[];
  }): Promise<void>;

  /** Delete all messages in a chat with id greater than the given id. */
  deleteMessagesAfter(chatId: string, afterId: number): Promise<void>;

  /** Update a message's status and response blocks. */
  updateMessage(params: {
    chatId: string;
    messageId: string;
    status: 'answering' | 'completed' | 'error';
    responseBlocks: Block[];
  }): Promise<void>;
}
