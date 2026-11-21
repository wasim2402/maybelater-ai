"use client";

import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser-side auth: sign up, sign in, sign out, delete account, and short-lived API tokens. */
export const authClient = createAuthClient({
  plugins: [jwtClient()],
});
