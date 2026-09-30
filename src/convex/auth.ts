// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation
// Adding the Password provider per the @convex-dev/auth Password docs.

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";
import { resetEmail } from "./auth/resetEmail";
import { google } from "./auth/google";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    emailOtp,
    Anonymous,
    google,
    Password({
      // Password reset codes are delivered via the dedicated reset email provider.
      reset: resetEmail as any,
    }),
  ],
  callbacks: {
    // After a successful Google sign-in, land the user exactly where they
    // asked to go (relative paths only — never bounce to an external origin).
    async redirect({ redirectTo }) {
      if (redirectTo?.startsWith("/") && !redirectTo.startsWith("//")) return redirectTo;
      return "/";
    },
  },
});
