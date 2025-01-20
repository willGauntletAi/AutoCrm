import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { Context } from './context';

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
    hello: t.procedure
        .input(z.object({ name: z.string().optional() }).optional())
        .query(({ input }) => {
            return {
                greeting: `Hello ${input?.name ?? 'world'}!`,
            };
        }),
});

export type AppRouter = typeof appRouter; 