import { TRPCError } from '@trpc/server';
import type { Context } from '../context';
import { t, procedure } from '../trpc';
import type { inferAsyncReturnType } from '@trpc/server';

// Define a type for the authenticated context
export type AuthenticatedContext = Context & {
    user: NonNullable<Context['user']>;
};

export const isAuthed = t.middleware(async ({ next, ctx }) => {
    const user = ctx.user;
    if (!user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
        });
    }

    return next({
        ctx: {
            ...ctx,
            user,
        } satisfies AuthenticatedContext,
    });
});

// Create an authenticated procedure by applying the auth middleware
export const authedProcedure = procedure.use(isAuthed); 