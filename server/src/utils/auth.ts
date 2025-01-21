import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { env } from './env';

export type AuthUser = {
    id: string;
    email: string;
    role: string;
    fullName: string | null;
    organizations: Record<string, string>;
};

const SupabaseJWTSchema = z.object({
    sub: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    app_metadata: z.object({
        provider: z.string().optional(),
    }).catchall(z.any()),
    user_metadata: z.record(z.any()),
    role: z.string().optional(),
    session_id: z.string(),
    aud: z.string(),
    iat: z.number(),
    exp: z.number(),
});

export async function verifyAuth(token: string | undefined): Promise<AuthUser> {
    if (!token) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'No token provided',
        });
    }

    try {
        // Remove 'Bearer ' prefix if present
        const jwt_token = token.replace('Bearer ', '');

        // Verify the JWT
        const payload = jwt.verify(jwt_token, env.SUPABASE_JWT_SECRET, {
            issuer: `${env.SUPABASE_URL}/auth/v1`,
            algorithms: ['HS256'],
        });

        // Validate the payload structure
        const result = SupabaseJWTSchema.safeParse(payload);
        if (!result.success) {
            console.error('JWT validation failed:', result.error);
            throw new Error('Invalid token payload structure');
        }

        const { session_id, sub } = result.data;

        // Fetch the user and their profile
        const user = await db
            .selectFrom('auth.sessions')
            .where('auth.sessions.id', '=', session_id)
            .where('user_id', '=', sub)
            .innerJoin('auth.users', 'auth.users.id', 'auth.sessions.user_id')
            .leftJoin('profiles', 'profiles.id', 'auth.users.id')
            .select([
                'auth.users.id',
                'auth.users.email',
                'auth.users.role',
                'profiles.full_name',
            ])
            .executeTakeFirst();

        if (!user) {
            throw new Error('Session not found');
        }

        // Fetch user's organization memberships
        const memberships = await db
            .selectFrom('profile_organization_members')
            .where('profile_id', '=', user.id)
            .select(['organization_id', 'role'])
            .execute();

        // Create organization role mapping
        const organizations = memberships.reduce<Record<string, string>>((acc, membership) => {
            acc[membership.organization_id] = membership.role || 'member';
            return acc;
        }, {});

        return {
            id: user.id,
            email: user.email || '',
            role: user.role || 'user',
            fullName: user.full_name || null,
            organizations,
        };
    } catch (error) {
        console.error('JWT verification failed:', error);
        if (error instanceof jwt.JsonWebTokenError) {
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'Invalid token',
            });
        } else if (error instanceof jwt.TokenExpiredError) {
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'Token expired',
            });
        }
        console.error('JWT verification failed:', error);
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid authorization token',
        });
    }
} 