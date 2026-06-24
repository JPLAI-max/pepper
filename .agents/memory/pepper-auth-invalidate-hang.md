---
name: Auth form stuck on "Just a moment…"
description: Why the login/signup button hangs after a successful auth, and the invalidation pattern that fixes it.
---

# Auth UI hang after successful login/signup

**Symptom:** user presses "Create account" / "Log in" and the button sticks on
"Just a moment…" forever (looks like "nothing happens"), even though the auth
request actually succeeded (signup 201, `/auth/me` 200, `pepper.sid` cookie set).

**Rule:** after an auth mutation, do NOT `await queryClient.invalidateQueries()`
with no filter. A blanket invalidate awaits the refetch of EVERY active query;
one slow/stuck active query (or a transient proxy 502 that then retries) keeps
that await pending, so the auth promise never resolves. Because AuthModal /
TrustGate flip `submitting`/`working` back in `finally` and only close/advance
*after* the awaited `login()`/`signup()` resolves, the form hangs indefinitely.

**Fix (in `AuthProvider.invalidateAll`):** await ONLY the identity query
(`invalidateQueries({ queryKey: getGetMeQueryKey() })`) so auth-gated routes flip
without a redirect bounce, then fire the blanket `invalidateQueries()` in the
background (`void`). Shared by login/signup/registerPasskey/loginWithPasskey/logout.

**Why:** the server/cookie/CSRF path was never the problem — server-side curl and
Playwright both showed the endpoints succeed. The bug was purely client-side
promise blocking on cache invalidation.

**How to apply:** any "await a mutation then invalidate then navigate" flow
should await only the query that gates the next screen, and background the rest.
Don't chase cookie/SameSite/CSRF theories when the network tab shows 2xx + a set
cookie but the UI never advances — look for an awaited blanket invalidate.
