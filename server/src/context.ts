import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { verifyAuth } from './utils/auth';
import type { AuthUser } from './types/auth';

export const createContext = async ({ req, res }: CreateExpressContextOptions) => {
    let user: AuthUser | null = null;

    try {
        const token = req.headers.authorization;
        if (token) {
            user = await verifyAuth(token);
        }
    } catch (error) {
        // If token verification fails, user remains null
        console.error('Auth error:', error);
    }

    return {
        req,
        res,
        user,
    };
};

export type Context = inferAsyncReturnType<typeof createContext>; 