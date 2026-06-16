import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { z } from "zod/v4";
import { db, users, credentials } from "@workspace/db";
import { establishSession, saveSession } from "../lib/authSession";
import { getWebAuthnContext } from "../lib/webauthn";

const router: IRouter = Router();

const EmailBody = z.object({ email: z.string().email() });

// --- Registration (PART 1): add a passkey to a brand-new account -----------

router.post("/auth/passkey/register/options", async (req, res) => {
  const parsed = EmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    res
      .status(409)
      .json({ error: "That email is already registered. Try unlocking instead." });
    return;
  }

  const { rpID, rpName } = getWebAuthnContext(req);
  // No account is created yet — an abandoned ceremony must leave no orphan user.
  const userHandle = randomUUID();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: email,
    userDisplayName: email,
    userID: new TextEncoder().encode(userHandle),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });

  req.session.currentChallenge = options.challenge;
  req.session.pendingEmail = email;
  req.session.pendingUserHandle = userHandle;
  await saveSession(req);

  res.json(options);
});

router.post("/auth/passkey/register/verify", async (req, res) => {
  const challenge = req.session.currentChallenge;
  const email = req.session.pendingEmail;
  if (!challenge || !email) {
    res.status(400).json({ error: "Your sign-up session expired. Please try again." });
    return;
  }

  // Strict single-use: consume the challenge BEFORE verifying so a failed
  // attempt can never be replayed against the same challenge.
  delete req.session.currentChallenge;
  delete req.session.pendingEmail;
  delete req.session.pendingUserHandle;
  await saveSession(req);

  const { rpID, origin } = getWebAuthnContext(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: req.body as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    req.log.warn({ err }, "Passkey registration verification failed");
    res.status(400).json({ error: "We couldn't verify that passkey. Please try again." });
    return;
  }

  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Passkey registration could not be verified." });
    return;
  }

  // Single-use challenge consumed — re-check the email is still free, then
  // create the account and bind the credential to it.
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "That email is already registered." });
    return;
  }

  const cred = verification.registrationInfo.credential;
  let user;
  try {
    // Atomic: never leave an orphan user if the credential insert fails.
    user = await db.transaction(async (tx) => {
      const created = await tx.insert(users).values({ email }).returning();
      const u = created[0]!;
      await tx.insert(credentials).values({
        userId: u.id,
        credentialId: cred.id,
        publicKey: Buffer.from(cred.publicKey).toString("base64url"),
        counter: cred.counter,
        transports: cred.transports ? JSON.stringify(cred.transports) : null,
      });
      return u;
    });
  } catch (err) {
    req.log.error({ err, email }, "Passkey account creation failed");
    res.status(500).json({ error: "Could not create your account. Please try again." });
    return;
  }

  await establishSession(req, user.id);

  res.status(201).json({ user: { id: user.id, email: user.email } });
});

// --- Authentication (PART 2): unlock a returning account with a passkey ----

router.post("/auth/passkey/login/options", async (req, res) => {
  const { rpID } = getWebAuthnContext(req);
  // Empty allowCredentials => discoverable (usernameless) login: the browser
  // offers the platform passkey bound to this RP ID.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });

  req.session.currentChallenge = options.challenge;
  await saveSession(req);

  res.json(options);
});

router.post("/auth/passkey/login/verify", async (req, res) => {
  const challenge = req.session.currentChallenge;
  if (!challenge) {
    res.status(400).json({ error: "Your unlock session expired. Please try again." });
    return;
  }

  // Strict single-use: consume the challenge BEFORE verifying.
  delete req.session.currentChallenge;
  await saveSession(req);

  const body = req.body as AuthenticationResponseJSON;
  const credId = body?.id;
  if (!credId) {
    res.status(400).json({ error: "Malformed passkey response." });
    return;
  }

  const foundCred = await db
    .select()
    .from(credentials)
    .where(eq(credentials.credentialId, credId))
    .limit(1);
  const credential = foundCred[0];
  if (!credential) {
    res.status(401).json({ error: "That passkey isn't recognized." });
    return;
  }

  const { rpID, origin } = getWebAuthnContext(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")),
        counter: credential.counter,
        transports: credential.transports
          ? (JSON.parse(credential.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
    });
  } catch (err) {
    req.log.warn({ err }, "Passkey authentication verification failed");
    res.status(401).json({ error: "We couldn't verify that passkey." });
    return;
  }

  if (!verification.verified) {
    res.status(401).json({ error: "Passkey verification failed." });
    return;
  }

  // Advance the stored signature counter (cloned-authenticator defense).
  await db
    .update(credentials)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(credentials.id, credential.id));

  const foundUser = await db
    .select()
    .from(users)
    .where(eq(users.id, credential.userId))
    .limit(1);
  const user = foundUser[0];
  if (!user) {
    res.status(401).json({ error: "Account not found." });
    return;
  }

  await establishSession(req, user.id);

  res.json({ user: { id: user.id, email: user.email } });
});

export default router;
