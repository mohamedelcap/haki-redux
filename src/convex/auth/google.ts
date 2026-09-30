import Google from "@auth/core/providers/google";

/**
 * Google OAuth provider for Convex Auth (HAKI sign-in with Google).
 *
 * Required environment variables (set them in the platform's API Keys UI):
 *  - AUTH_GOOGLE_ID      (Google OAuth 2.0 Client ID)
 *  - AUTH_GOOGLE_SECRET  (Google OAuth 2.0 Client Secret)
 *
 * In the Google Cloud Console (APIs & Services → Credentials → OAuth client)
 * add this exact Authorized redirect URI for this deployment:
 *   <CONVEX_SITE_URL>/api/auth/callback/google
 * e.g. https://reliable-hippopotamus-360.convex.site/api/auth/callback/google
 */
export const google = Google({
  clientId: process.env.AUTH_GOOGLE_ID,
  clientSecret: process.env.AUTH_GOOGLE_SECRET,
  // Show the account chooser every time (no silent re-auth with a stale account).
  authorization: { params: { prompt: "select_account" } },
  // Off by default: a Google-verified email must not silently take over an
  // existing password account. Users can link accounts from Settings later.
  allowDangerousEmailAccountLinking: false,
});
