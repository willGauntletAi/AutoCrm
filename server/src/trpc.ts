import { initTRPC } from '@trpc/server';
import type { Context } from './context';
import { isAuthed } from './middleware/auth';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const procedure = t.procedure;
export const middleware = t.middleware;

// Create an authenticated procedure by applying the auth middleware
export const authedProcedure = t.procedure.use(isAuthed); 