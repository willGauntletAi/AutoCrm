import { z } from 'zod';
import { router, procedure, authedProcedure } from './trpc';
import { createOrganization } from './handlers/organization';

export const appRouter = router({
    hello: procedure
        .input(z.object({ name: z.string().optional() }).optional())
        .query(({ input }) => {
            return {
                greeting: `Hello ${input?.name ?? 'world'}!`,
            };
        }),

    createOrganization: authedProcedure
        .input(z.object({
            name: z.string().min(1).max(255),
        }))
        .mutation(({ input, ctx }) => {
            return createOrganization({
                name: input.name,
                userId: ctx.user.id
            });
        }),
});

export type AppRouter = typeof appRouter; 