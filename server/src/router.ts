import { z } from 'zod';
import { router, procedure } from './trpc';
import { createOrganization, getOrganizations } from './handlers/organization';
import { authedProcedure } from './middleware/auth';

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

    getOrganizations: authedProcedure
        .query(({ ctx }) => {
            return getOrganizations({
                userId: ctx.user.id
            });
        }),
});

export type AppRouter = typeof appRouter; 