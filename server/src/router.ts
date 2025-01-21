import { z } from 'zod';
import { router, procedure } from './trpc';
import { createOrganization, getOrganizations } from './handlers/organization';
import { createTicket, getTickets } from './handlers/ticket';
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

    createTicket: authedProcedure
        .input(z.object({
            title: z.string().min(1).max(255),
            description: z.string().optional(),
            organization_id: z.string().uuid()
        }))
        .mutation(({ input, ctx }) => {
            return createTicket({
                ...input,
                userId: ctx.user.id
            });
        }),

    getTickets: authedProcedure
        .input(z.object({
            organization_id: z.string().uuid()
        }))
        .query(({ input, ctx }) => {
            return getTickets({
                organization_id: input.organization_id,
                userId: ctx.user.id
            });
        }),
});

export type AppRouter = typeof appRouter; 