import { z } from 'zod';
import { router, procedure } from './trpc';
import { createOrganization, getOrganizations } from './handlers/organization';
import { createTicket, getTickets, getTicket, getTicketComments, createTicketComment } from './handlers/ticket';
import { getProfile, createProfile } from './handlers/profile';
import { authedProcedure } from './middleware/auth';

export const appRouter = router({
    hello: procedure
        .input(z.object({ name: z.string().optional() }).optional())
        .query(({ input }) => {
            return {
                greeting: `Hello ${input?.name ?? 'world'}!`,
            };
        }),

    getProfile: authedProcedure
        .query(({ ctx }) => {
            return getProfile({
                userId: ctx.user.id
            });
        }),

    createProfile: authedProcedure
        .input(z.object({
            fullName: z.string().min(1).max(255),
            avatarUrl: z.string().url().nullish(),
        }))
        .mutation(({ input, ctx }) => {
            return createProfile({
                userId: ctx.user.id,
                fullName: input.fullName,
                avatarUrl: input.avatarUrl,
            });
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
            priority: z.enum(['low', 'medium', 'high']),
            organization_id: z.string().uuid()
        }))
        .mutation(({ input, ctx }) => {
            return createTicket({
                ...input,
                ctx
            });
        }),

    getTickets: authedProcedure
        .input(z.object({
            organization_id: z.string().uuid()
        }))
        .query(({ input, ctx }) => {
            return getTickets({
                organization_id: input.organization_id,
                ctx
            });
        }),

    getTicket: authedProcedure
        .input(z.object({
            ticket_id: z.number()
        }))
        .query(({ input, ctx }) => {
            return getTicket({
                ticket_id: input.ticket_id,
                ctx
            });
        }),

    getTicketComments: authedProcedure
        .input(z.object({
            ticket_id: z.number()
        }))
        .query(({ input, ctx }) => {
            return getTicketComments({
                ticket_id: input.ticket_id,
                ctx
            });
        }),

    createTicketComment: authedProcedure
        .input(z.object({
            ticket_id: z.number(),
            comment: z.string().min(1)
        }))
        .mutation(({ input, ctx }) => {
            return createTicketComment({
                ticket_id: input.ticket_id,
                comment: input.comment,
                ctx
            });
        }),
});

export type AppRouter = typeof appRouter; 