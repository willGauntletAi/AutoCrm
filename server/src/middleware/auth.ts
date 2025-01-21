import { TRPCError } from '@trpc/server';
import type { Context } from '../context';
import { middleware } from '../trpc';

// Define a type for the authenticated context
export type AuthenticatedContext = Context & {
    user: NonNullable<Context['user']>;
};

export const isAuthed = middleware(({ next, ctx }) => {
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