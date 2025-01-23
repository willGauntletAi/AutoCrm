import { z } from 'zod';
import { router, procedure } from './trpc';
import { createOrganization, getOrganizations } from './handlers/organization';
import { authedProcedure } from './middleware/auth';
import { createProfile } from './handlers/profile';
import { getProfile } from './handlers/profile';
import { SyncInputSchema } from './handlers/sync/schema';
import { sync } from './handlers/sync';
import { acceptInvitation, acceptInvitationSchema } from './handlers/invitations';

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

    sync: authedProcedure
        .input(SyncInputSchema)
        .mutation(({ input, ctx }) => {
            return sync({
                data: input,
                ctx
            });
        }),

    acceptInvitation: authedProcedure
        .input(acceptInvitationSchema)
        .mutation(({ input, ctx }) => {
            return acceptInvitation(input, ctx.user.id);
        }),
});

export type AppRouter = typeof appRouter; 