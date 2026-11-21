import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/server";

/** Better Auth endpoints: /api/auth/sign-up/email, /sign-in/email, /sign-out, /token, /jwks, /delete-user ... */
export const { GET, POST } = toNextJsHandler(auth);
