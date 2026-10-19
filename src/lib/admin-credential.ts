/** Route private tools through the same verified, revocable admin session. */
export async function verifyAdminCredential<T>(
  credential: string,
  verifiers: {
    session: (token: string) => Promise<T>;
    password: (password: string) => Promise<T>;
  },
): Promise<T> {
  const value = (credential ?? "").trim();
  if (!value) throw new Error("Inicia sesión como administradora para abrir esta herramienta");
  // An expired/revoked session must never fall back to password authentication.
  return value.startsWith("ma2s_")
    ? verifiers.session(value)
    : verifiers.password(value);
}
