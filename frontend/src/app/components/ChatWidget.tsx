import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, formatPhone } from "../lib/countryCodes";

/**
 * Preventive vitamin recommender — real client.
 *
 * First use shows a registration + informed-consent gate (the exact legal text
 * is fetched from `GET /assistant/consent`, never hardcoded). Once registered,
 * chat goes through `POST /assistant/ask`; returning customers reload their
 * persisted conversation via `GET /assistant/history`. If the backend flags a
 * stale consent version (`401 CONSENT_REQUIRED`), the gate is shown again with
 * the current text.
 *
 * The Gemini key never reaches the browser: the frontend only calls `/api/*`,
 * which the Vite dev proxy forwards to the backend (vite.config.ts).
 */

interface ConsentInfo {
  version: number;
  text: string;
}

interface ChatMessage {
  sender: "user" | "agent";
  text: string;
}

type Phase = "boot" | "gate" | "chat";

const STORAGE = {
  customerId: "vr_customer_id",
  conversationId: "vr_conversation_id",
};

function readStoredNumber(key: string): number | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function readStoredConsentVersion(): number | null {
  const raw = window.localStorage.getItem("vr_consent_version");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("boot");
  const [consent, setConsent] = useState<ConsentInfo | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentReentry, setConsentReentry] = useState(false);

  // Registration form state.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState(DEFAULT_COUNTRY_CODE);
  const [referrerPhone, setReferrerPhone] = useState("");
  const [referrerCode, setReferrerCode] = useState(DEFAULT_COUNTRY_CODE);
  const [agreed, setAgreed] = useState(false);

  // Session identity (persisted so returning users resume their conversation).
  const [customerId, setCustomerId] = useState<number | null>(() => readStoredNumber(STORAGE.customerId));
  const [conversationId, setConversationId] = useState<number | null>(() =>
    readStoredNumber(STORAGE.conversationId),
  );
  const consentedVersion = useRef<number | null>(readStoredConsentVersion());

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchConsent = useCallback(async (): Promise<ConsentInfo | null> => {
    try {
      const res = await fetch("/api/assistant/consent");
      if (!res.ok) return null;
      return (await res.json()) as ConsentInfo;
    } catch {
      return null;
    }
  }, []);

  const loadConsent = useCallback(async () => {
    setConsentLoading(true);
    const info = await fetchConsent();
    if (info) {
      setConsent(info);
      setConsentError(null);
    } else {
      setConsentError(
        "No pudimos cargar el consentimiento informado. Comprueba que el servidor esté disponible e inténtalo de nuevo.",
      );
    }
    setConsentLoading(false);
  }, [fetchConsent]);

  // On first open: decide between the consent gate (new visitor) or the chat
  // (returning customer, whose prior conversation is restored from memory).
  useEffect(() => {
    if (!isOpen || phase !== "boot") return;
    if (customerId == null) {
      setConsentReentry(false);
      setPhase("gate");
      void loadConsent();
    } else {
      setPhase("chat");
      setMessages([{ sender: "agent", text: "¡Hola! ¿En qué te puedo ayudar hoy con tu bienestar?" }]);
      if (conversationId != null) void loadHistory();
    }
  }, [isOpen, phase, customerId, conversationId, loadConsent]);

  const loadHistory = useCallback(async () => {
    if (customerId == null || conversationId == null) return;
    try {
      const res = await fetch(
        `/api/assistant/history?conversation_id=${conversationId}&customer_id=${customerId}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: Array<{ role: string; content: string }> };
      const restored: ChatMessage[] = data.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ sender: m.role === "user" ? "user" : "agent", text: m.content }));
      if (restored.length > 0) setMessages(restored);
    } catch {
      // History is best-effort memory; a failure here keeps the greeting.
    }
  }, [customerId, conversationId]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  const persistIdentity = (id: number, convId: number | null) => {
    window.localStorage.setItem(STORAGE.customerId, String(id));
    setCustomerId(id);
    if (convId != null) {
      window.localStorage.setItem(STORAGE.conversationId, String(convId));
      setConversationId(convId);
    } else {
      window.localStorage.removeItem(STORAGE.conversationId);
      setConversationId(null);
    }
  };

  const handleConsentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (consent == null) return;
    setConsentError(null);

    if (!agreed) {
      setConsentError("Debes aceptar el consentimiento informado para continuar.");
      return;
    }
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setConsentError("Nombre, correo electrónico y teléfono son obligatorios.");
      return;
    }

    setConsentLoading(true);
    try {
      const res = await fetch("/api/assistant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: formatPhone(phoneCode, phone),
          referrer_phone: referrerPhone.trim() ? formatPhone(referrerCode, referrerPhone) : null,
          consent_version: consent.version,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { customer_id: number };
        window.localStorage.setItem("vr_consent_version", String(consent.version));
        consentedVersion.current = consent.version;
        // Upsert re-consents an existing customer in place (same id). On
        // re-entry after 401, preserve their conversation; a fresh registration
        // starts a new conversation.
        const keepConv = consentReentry && conversationId != null ? conversationId : null;
        persistIdentity(data.customer_id, keepConv);
        if (keepConv == null) {
          setMessages([{ sender: "agent", text: "¡Hola! ¿En qué te puedo ayudar hoy con tu bienestar?" }]);
        }
        setChatError(null);
        setPhase("chat");
      } else if (res.status === 409) {
        setConsentError(
          "Ya existe una cuenta con ese correo o teléfono y el consentimiento no pudo renovarse automáticamente. Contáctanos para actualizar tus datos o inténtalo con otro correo.",
        );
      } else {
        setConsentError(
          "No pudimos completar el registro. Revisa los datos e inténtalo de nuevo.",
        );
      }
    } catch {
      setConsentError("No pudimos conectar con el servidor. Inténtalo de nuevo en unos momentos.");
    } finally {
      setConsentLoading(false);
    }
  };

  const appendMessage = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || sending) return;

    if (customerId == null) {
      // No registered customer yet — bring back the consent gate.
      setConsentReentry(false);
      setPhase("gate");
      void loadConsent();
      return;
    }

    setInputValue("");
    setChatError(null);
    appendMessage({ sender: "user", text });
    setSending(true);

    try {
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          conversation_id: conversationId ?? undefined,
          message: text,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          conversation_id: number;
          reply: string;
        };
        persistIdentity(customerId, data.conversation_id);
        appendMessage({ sender: "agent", text: data.reply });
      } else if (res.status === 401) {
        // Stale consent → re-show the gate with the current legal text.
        let info = consent;
        try {
          const data = (await res.json()) as { consent?: ConsentInfo };
          if (data.consent) info = data.consent;
        } catch {
          /* fall back to cached consent */
        }
        if (!info) info = await fetchConsent();
        if (info) {
          setConsent(info);
          setConsentError(null);
        }
        setConsentReentry(true);
        setPhase("gate");
      } else if (res.status === 503) {
        appendMessage({
          sender: "agent",
          text: "El motor de recomendación está temporalmente no disponible. Por favor, inténtalo de nuevo en unos momentos.",
        });
      } else {
        appendMessage({
          sender: "agent",
          text: "Algo salió mal al procesar tu mensaje. Por favor, inténtalo de nuevo.",
        });
      }
    } catch {
      appendMessage({
        sender: "agent",
        text: "No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.",
      });
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-900 transition-shadow";

  const codeSelectCls =
    "w-[112px] shrink-0 px-2 py-2 bg-stone-100 border border-stone-200 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-900 transition-shadow";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-200 flex flex-col h-[440px]"
          >
            {/* Header */}
            <div className="bg-emerald-900 px-4 py-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-800 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-emerald-100" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Recomendador Preventivo</h4>
                  <p className="text-xs text-emerald-200">En línea</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-emerald-200 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {phase === "gate" ? (
              /* Registration + informed-consent gate */
              <div className="flex-1 overflow-y-auto p-4 bg-stone-50">
                <h4 className="font-semibold text-stone-800 text-sm mb-1">
                  {consentReentry ? "Actualiza tu consentimiento" : "Antes de empezar"}
                </h4>
                <p className="text-xs text-stone-500 mb-3">
                  {consentReentry
                    ? "Necesitamos tu consentimiento actualizado para continuar la conversación."
                    : "Por favor, lee y acepta el consentimiento informado para recibir recomendaciones."}
                </p>

                {consentLoading && !consent ? (
                  <p className="text-xs text-stone-500">Cargando términos...</p>
                ) : consent ? (
                  <form onSubmit={handleConsentSubmit} className="flex flex-col gap-3">
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-stone-200 bg-white p-3">
                      <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-stone-600 font-sans">
                        {consent.text}
                      </pre>
                    </div>

                    <label className="text-xs text-stone-600">
                      Nombre
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputCls}
                        placeholder="Tu nombre"
                      />
                    </label>
                    <label className="text-xs text-stone-600">
                      Correo electrónico
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputCls}
                        placeholder="correo@ejemplo.com"
                      />
                    </label>
                    <label className="text-xs text-stone-600">
                      Teléfono
                      <div className="flex gap-2">
                        <select
                          value={phoneCode}
                          onChange={(e) => setPhoneCode(e.target.value)}
                          className={codeSelectCls}
                          aria-label="Indicativo del país"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={`${c.code}-${c.name}`} value={c.code}>
                              {c.code} {c.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className={inputCls}
                          placeholder="Número de contacto"
                        />
                      </div>
                    </label>
                    <label className="text-xs text-stone-600">
                      Teléfono de referido (opcional)
                      <div className="flex gap-2">
                        <select
                          value={referrerCode}
                          onChange={(e) => setReferrerCode(e.target.value)}
                          className={codeSelectCls}
                          aria-label="Indicativo del país del referido"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={`${c.code}-${c.name}`} value={c.code}>
                              {c.code} {c.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          value={referrerPhone}
                          onChange={(e) => setReferrerPhone(e.target.value)}
                          className={inputCls}
                          placeholder="Quién te recomendó"
                        />
                      </div>
                    </label>

                    <label className="flex items-start gap-2 text-xs text-stone-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-0.5 accent-emerald-900"
                      />
                      <span>
                        He leído y acepto el consentimiento informado (versión {consent.version}).
                      </span>
                    </label>

                    {consentError && (
                      <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{consentError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={consentLoading}
                      className="w-full py-2.5 bg-emerald-900 text-white text-sm font-medium rounded-full disabled:opacity-50 hover:bg-emerald-800 transition-colors"
                    >
                      {consentLoading ? "Procesando..." : "Aceptar y continuar"}
                    </button>
                  </form>
                ) : (
                  <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{consentError ?? "No pudimos cargar el consentimiento."}</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Messages Area */}
                <div
                  ref={scrollRef}
                  className="flex-1 p-4 overflow-y-auto bg-stone-50 flex flex-col gap-3"
                >
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                        msg.sender === "user"
                          ? "bg-emerald-900 text-white rounded-br-none self-end"
                          : "bg-white border border-stone-200 text-stone-700 rounded-bl-none self-start shadow-sm whitespace-pre-wrap"
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {sending && (
                    <div className="max-w-[80%] p-3 rounded-2xl text-sm bg-white border border-stone-200 text-stone-400 self-start shadow-sm">
                      Escribiendo...
                    </div>
                  )}
                  {chatError && (
                    <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 self-stretch">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{chatError}</span>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white border-t border-stone-200">
                  <form onSubmit={handleSend} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      className="flex-1 px-4 py-2 bg-stone-100 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-emerald-900 transition-shadow"
                    />
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || sending}
                      className="w-10 h-10 bg-emerald-900 text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-800 transition-colors shrink-0"
                    >
                      {sending ? (
                        <CheckCircle2 className="w-4 h-4 ml-1" />
                      ) : (
                        <Send className="w-4 h-4 ml-1" />
                      )}
                    </button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-emerald-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-800 transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-900/30"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}