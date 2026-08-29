import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { customers } from "../db/schema.js";
import type { Customer } from "../db/schema.js";
import { CURRENT_CONSENT_VERSION } from "../config/consent.js";

/**
 * Customer service: registration + consent versioning.
 *
 * Registration is data capture + consent, NOT login (no password/session).
 * Consent is VERSION-GATED, not presence-gated: a customer whose
 * `consent_version < CURRENT_CONSENT_VERSION` must re-consent before any new
 * recommendation, while prior records are preserved.
 */

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  referrerPhone?: string | null;
  consentVersion: number;
}

export type RegisterResult =
  | { status: "ok"; customer: Customer }
  | { status: "invalid"; reason: string }
  | { status: "conflict"; field: "email" | "phone" };

export interface CustomerService {
  register(input: RegisterInput): RegisterResult;
  getById(id: number): Customer | undefined;
  getByEmail(email: string): Customer | undefined;
  /** True when the customer's consent is current for new recommendations. */
  hasCurrentConsent(customerId: number): boolean;
  /** Re-consents a customer to the current version, preserving records. */
  reConsent(customerId: number): Customer | undefined;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function createCustomerService(db: Db): CustomerService {
  return {
    register(input: RegisterInput): RegisterResult {
      const name = input.name?.trim();
      const email = normalize(input.email ?? "");
      const phone = input.phone?.trim();
      if (!name || !email || !phone) {
        return { status: "invalid", reason: "name, email y phone son obligatorios" };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { status: "invalid", reason: "email no válido" };
      }
      if (input.consentVersion !== CURRENT_CONSENT_VERSION) {
        return { status: "invalid", reason: `consent_version debe ser ${CURRENT_CONSENT_VERSION}` };
      }

      // Uniqueness on email/phone (case-insensitive for email).
      const dupEmail = db.select().from(customers).where(eq(customers.email, email)).get();
      if (dupEmail) {
        return { status: "conflict", field: "email" };
      }
      const dupPhone = db
        .select()
        .from(customers)
        .where(eq(customers.phone, input.phone.trim()))
        .get();
      if (dupPhone) {
        return { status: "conflict", field: "phone" };
      }

      const now = new Date().toISOString();
      const inserted = db
        .insert(customers)
        .values({
          name,
          email,
          phone: input.phone.trim(),
          referrerPhone: input.referrerPhone?.trim() || null,
          consentVersion: input.consentVersion,
          consentTimestamp: now,
          registeredAt: now,
        })
        .returning()
        .get();
      return { status: "ok", customer: inserted };
    },

    getById(id: number): Customer | undefined {
      return db.select().from(customers).where(eq(customers.id, id)).get();
    },

    getByEmail(email: string): Customer | undefined {
      return db.select().from(customers).where(eq(customers.email, normalize(email))).get();
    },

    hasCurrentConsent(customerId: number): boolean {
      const row = db.select().from(customers).where(eq(customers.id, customerId)).get();
      if (!row) return false;
      return row.consentVersion >= CURRENT_CONSENT_VERSION;
    },

    reConsent(customerId: number): Customer | undefined {
      const now = new Date().toISOString();
      return db
        .update(customers)
        .set({ consentVersion: CURRENT_CONSENT_VERSION, consentTimestamp: now })
        .where(eq(customers.id, customerId))
        .returning()
        .get();
    },
  };
}