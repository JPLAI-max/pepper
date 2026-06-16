import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

const API_BASE = "/api";

/** Error carrying a user-facing message for the trust gate to display. */
export class PasskeyError extends Error {}

async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    credentials: "include",
  });
  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new PasskeyError(message);
  }
  return (await res.json()) as T;
}

/** Whether this browser exposes the WebAuthn API at all. */
export function passkeySupported(): boolean {
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

/**
 * PART 1 — register a passkey for a brand-new account. The challenge and the
 * account are created server-side; navigator.credentials.create() runs against
 * the server's single-use challenge, then the attestation is verified server-side.
 */
export async function registerPasskey(email: string): Promise<void> {
  const optionsJSON = await postJSON<PublicKeyCredentialCreationOptionsJSON>(
    "/auth/passkey/register/options",
    { email },
  );
  let attResp;
  try {
    attResp = await startRegistration({ optionsJSON });
  } catch (err) {
    throw new PasskeyError(translateWebAuthnError(err));
  }
  await postJSON("/auth/passkey/register/verify", attResp);
}

/**
 * PART 2 — unlock a returning account with its passkey. Uses a discoverable
 * (usernameless) credential: navigator.credentials.get() runs against the
 * server's single-use challenge and the assertion is verified server-side,
 * which then establishes the existing cookie session.
 */
export async function loginPasskey(): Promise<void> {
  const optionsJSON = await postJSON<PublicKeyCredentialRequestOptionsJSON>(
    "/auth/passkey/login/options",
  );
  let authResp;
  try {
    authResp = await startAuthentication({ optionsJSON });
  } catch (err) {
    throw new PasskeyError(translateWebAuthnError(err));
  }
  await postJSON("/auth/passkey/login/verify", authResp);
}

function translateWebAuthnError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError") {
    return "That was cancelled or timed out. You can use a password instead.";
  }
  if (name === "InvalidStateError") {
    return "A passkey already exists on this device for this account.";
  }
  if (name === "SecurityError" || name === "NotSupportedError") {
    return "Passkeys aren't available here. Open the app in a full browser tab, or use a password instead.";
  }
  return "Your device couldn't complete the passkey. You can use a password instead.";
}
