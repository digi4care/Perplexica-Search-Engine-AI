import type { Block } from '@/lib/types';
import db from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import type { MessageStore, MessageRecord } from '@/lib/ports';

/**
 * Adapter that implements MessageStore using Drizzle ORM against the messages table.
 */
export class DrizzleMessageStore implements MessageStore {
  async findMessage(params: {
    chatId: string;
    messageId: string;
  }): Promise<MessageRecord | undefined> {
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.chatId, params.chatId),
          eq(messages.messageId, params.messageId),
        ),
      );

    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
      id: row.id,
      messageId: row.messageId,
      chatId: row.chatId,
      backendId: row.backendId,
      query: row.query,
      createdAt: row.createdAt,
      responseBlocks: row.responseBlocks ?? [],
      status: row.status ?? 'answering',
    };
  }

  async insertMessage(params: {
    chatId: string;
    messageId: string;
    backendId: string;
    query: string;
    createdAt: string;
    status: 'answering';
    responseBlocks: Block[];
  }): Promise<void> {
    await db.insert(messages).values({
      chatId: params.chatId,
      messageId: params.messageId,
      backendId: params.backendId,
      query: params.query,
      createdAt: params.createdAt,
      status: params.status,
      responseBlocks: params.responseBlocks,
    });
  }

  async deleteMessagesAfter(chatId: string, afterId: number): Promise<void> {
    await db
      .delete(messages)
      .where(
        and(eq(messages.chatId, chatId), gt(messages.id, afterId)),
      );
  }

  async updateMessage(params: {
    chatId: string;
    messageId: string;
    status: 'answering' | 'completed' | 'error';
    responseBlocks: Block[];
  }): Promise<void> {
    await db
      .update(messages)
      .set({
        status: params.status,
        responseBlocks: params.responseBlocks,
      })
      .where(
        and(
          eq(messages.chatId, params.chatId),
          eq(messages.messageId, params.messageId),
        ),
      );
  }
}
