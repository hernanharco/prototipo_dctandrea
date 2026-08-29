// Country dialing codes for international phone numbers.
// UI language: Spanish (neutral/professional).

export interface CountryCode {
  /** Dialing code including "+", e.g. "+34" */
  code: string;
  /** Country name in Spanish */
  name: string;
}

export const DEFAULT_COUNTRY_CODE = "+34";

export const COUNTRY_CODES: CountryCode[] = [
  { code: "+34", name: "España" },
  { code: "+52", name: "México" },
  { code: "+54", name: "Argentina" },
  { code: "+56", name: "Chile" },
  { code: "+57", name: "Colombia" },
  { code: "+51", name: "Perú" },
  { code: "+58", name: "Venezuela" },
  { code: "+593", name: "Ecuador" },
  { code: "+591", name: "Bolivia" },
  { code: "+595", name: "Paraguay" },
  { code: "+598", name: "Uruguay" },
  { code: "+505", name: "Nicaragua" },
  { code: "+506", name: "Costa Rica" },
  { code: "+507", name: "Panamá" },
  { code: "+504", name: "Honduras" },
  { code: "+503", name: "El Salvador" },
  { code: "+502", name: "Guatemala" },
  { code: "+53", name: "Cuba" },
  { code: "+1", name: "Estados Unidos / Canadá" },
  { code: "+1", name: "Puerto Rico / Rep. Dominicana" },
  { code: "+351", name: "Portugal" },
  { code: "+33", name: "Francia" },
  { code: "+39", name: "Italia" },
  { code: "+49", name: "Alemania" },
  { code: "+44", name: "Reino Unido" },
  { code: "+353", name: "Irlanda" },
  { code: "+31", name: "Países Bajos" },
  { code: "+32", name: "Bélgica" },
  { code: "+41", name: "Suiza" },
  { code: "+43", name: "Austria" },
  { code: "+46", name: "Suecia" },
  { code: "+47", name: "Noruega" },
  { code: "+45", name: "Dinamarca" },
  { code: "+358", name: "Finlandia" },
  { code: "+48", name: "Polonia" },
  { code: "+420", name: "República Checa" },
  { code: "+30", name: "Grecia" },
  { code: "+7", name: "Rusia" },
  { code: "+380", name: "Ucrania" },
  { code: "+86", name: "China" },
  { code: "+81", name: "Japón" },
  { code: "+82", name: "Corea del Sur" },
  { code: "+91", name: "India" },
  { code: "+92", name: "Pakistán" },
  { code: "+62", name: "Indonesia" },
  { code: "+66", name: "Tailandia" },
  { code: "+84", name: "Vietnam" },
  { code: "+63", name: "Filipinas" },
  { code: "+60", name: "Malasia" },
  { code: "+65", name: "Singapur" },
  { code: "+90", name: "Turquía" },
  { code: "+972", name: "Israel" },
  { code: "+971", name: "Emiratos Árabes" },
  { code: "+966", name: "Arabia Saudita" },
  { code: "+212", name: "Marruecos" },
  { code: "+20", name: "Egipto" },
  { code: "+234", name: "Nigeria" },
  { code: "+27", name: "Sudáfrica" },
  { code: "+254", name: "Kenia" },
  { code: "+61", name: "Australia" },
  { code: "+64", name: "Nueva Zelanda" },
];

/**
 * Builds an E.164-style phone string: dialing code + local digits.
 * Strips spaces, dashes and parentheses from the local number.
 */
export function formatPhone(code: string, number: string): string {
  const digits = number.replace(/[\s\-()]/g, "");
  return `${code}${digits}`;
}