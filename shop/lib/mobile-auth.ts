export function bearerToken(header: string | null) {
  const match = /^Bearer ([a-f0-9-]{72})$/i.exec(header || "");
  return match?.[1] || "";
}
export function validMobileChallenge(value: string) { return /^[a-f0-9]{64}$/.test(value); }
export function validMobileVerifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(value);
}
export const mobileReturn = "okirika://auth";
