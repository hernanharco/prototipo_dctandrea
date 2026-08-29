// Dev-only CRM client for the /admin pages.
//
// Every request goes through the Vite dev proxy (`/api/*` → backend, prefix
// stripped). The backend returns 403 outside NODE_ENV=development — the admin
// UI surfaces that guard as a friendly message rather than assuming access.

export interface Product {
  reference: string;
  name: string;
  category: string;
  size: string;
  price: number;
  benefits: string;
  dosage: string;
  ingredients: string;
  disclaimer: string;
}

export type ProductInput = Omit<Product, "reference"> & { reference: string };

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  referrerPhone: string | null;
  consentVersion: number;
  consentTimestamp: string;
  registeredAt: string;
  createdAt: string;
}

export interface Conversation {
  id: number;
  customerId: number;
  createdAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Purchase {
  id: number;
  customerId: number;
  productReference: string;
  qty: number;
  purchasedAt: string;
}

export interface PurchaseInput {
  customerId: number;
  productReference: string;
  qty: number;
}

export interface Recommendation {
  id: number;
  conversationId: number;
  customerId: number;
  symptom: string;
  productReferences: string; // JSON array of valid catalog refs
  rationale: string;
  consentVersion: number;
  guardBlocked: boolean;
  createdAt: string;
}

export interface Guidance {
  id: number;
  title: string;
  content: string;
  productReferences: string; // JSON array of catalog refs
  enabled: number; // 0 | 1
  createdAt: string;
  updatedAt: string;
}

export interface GuidanceInput {
  title: string;
  content: string;
  product_references: string[];
}

export type GuidancePatch = Partial<GuidanceInput> & { enabled?: number };

export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminError";
    this.status = status;
  }
}

// Basic-auth session for the /admin CRM in non-dev environments.
// In development the backend is open; in production the browser stores the
// credentials (sessionStorage only — never persisted) and sends them on every
// admin request.
let adminAuth: string | null = (() => {
  try {
    return sessionStorage.getItem("vr_admin_auth");
  } catch {
    return null;
  }
})();

export function setAdminAuth(user: string, pass: string): void {
  adminAuth = btoa(`${user}:${pass}`);
  try {
    sessionStorage.setItem("vr_admin_auth", adminAuth);
  } catch {
    /* storage unavailable */
  }
}

export function clearAdminAuth(): void {
  adminAuth = null;
  try {
    sessionStorage.removeItem("vr_admin_auth");
  } catch {
    /* storage unavailable */
  }
}

export function hasAdminAuth(): boolean {
  return adminAuth !== null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(adminAuth ? { Authorization: `Basic ${adminAuth}` } : {}),
    },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new AdminError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return body as unknown as T;
}

export const api = {
  listProducts: () => request<{ products: Product[] }>("/catalog"),
  createProduct: (input: ProductInput) =>
    request<{ product: Product }>("/catalog", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProduct: (reference: string, patch: Partial<ProductInput>) =>
    request<{ product: Product }>(`/catalog/${encodeURIComponent(reference)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  listCustomers: () => request<{ customers: Customer[] }>("/customers"),
  listConversations: () =>
    request<{ conversations: Conversation[] }>("/conversations"),
  listMessages: (id: number) =>
    request<{ messages: Message[] }>(`/conversations/${id}/messages`),
  listPurchases: () => request<{ purchases: Purchase[] }>("/purchases"),
  createPurchase: (input: PurchaseInput) =>
    request<{ purchase: Purchase }>("/purchases", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listRecommendations: () =>
    request<{ recommendations: Recommendation[] }>("/recommendations"),
  listGuidance: () => request<{ guidance: Guidance[] }>("/guidance"),
  createGuidance: (input: GuidanceInput) =>
    request<{ guidance: Guidance }>("/guidance", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateGuidance: (id: number, patch: GuidancePatch) =>
    request<{ guidance: Guidance }>(`/guidance/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  toggleGuidance: (id: number, enabled: number) =>
    request<{ guidance: Guidance }>(`/guidance/${id}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
  deleteGuidance: (id: number) =>
    request<null>(`/guidance/${id}`, { method: "DELETE" }),
};