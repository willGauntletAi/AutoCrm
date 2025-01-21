import { TRPCError } from '@trpc/server';
import { procedure } from '../trpc';

export const authedProcedure = procedure.use(async ({ ctx, next }) => {
    if (!ctx.user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You must be logged in to do this'
        });
    }
    return next({
        ctx: {
            ...ctx,
            user: ctx.user,
        },
    });
}); 