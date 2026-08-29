import { eq, asc } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { conversations, messages, purchases } from "../db/schema.js";
import type { Conversation, Message } from "../db/schema.js";

/**
 * Conversation service: persistence of conversations + messages and server-side
 * purchase-context loading for agent injection.
 */

export interface ConversationService {
  /** Creates a conversation for a customer (used when none is supplied). */
  createConversation(customerId: number): Conversation;
  /** Loads messages for a conversation, oldest first (multi-turn continuity). */
  loadMessages(conversationId: number): Message[];
  /** Loads message pairs (role/content) for prompt injection. */
  loadHistory(conversationId: number): Array<{ role: "user" | "assistant"; content: string }>;
  /** Appends a message and returns it. */
  saveMessage(conversationId: number, role: "user" | "assistant", content: string): Message;
  /** Loads the customer's purchase product references (server-side injection). */
  loadPurchases(customerId: number): string[];
  /** Verifies a conversation belongs to a customer. */
  belongsToCustomer(conversationId: number, customerId: number): boolean;
}

export function createConversationService(db: Db): ConversationService {
  return {
    createConversation(customerId: number): Conversation {
      return db.insert(conversations).values({ customerId }).returning().get();
    },

    loadMessages(conversationId: number): Message[] {
      return db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.id))
        .all();
    },

    loadHistory(conversationId: number): Array<{ role: "user" | "assistant"; content: string }> {
      return this.loadMessages(conversationId).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    },

    saveMessage(conversationId: number, role: "user" | "assistant", content: string): Message {
      return db.insert(messages).values({ conversationId, role, content }).returning().get();
    },

    loadPurchases(customerId: number): string[] {
      const rows = db
        .select()
        .from(purchases)
        .where(eq(purchases.customerId, customerId))
        .orderBy(asc(purchases.id))
        .all();
      return rows.map((r) => r.productReference);
    },

    belongsToCustomer(conversationId: number, customerId: number): boolean {
      const row = db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .get();
      return row ? row.customerId === customerId : false;
    },
  };
}