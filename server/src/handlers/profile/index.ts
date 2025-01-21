import { db } from '../../db';

interface GetProfileParams {
    userId: string;
}

interface CreateProfileParams {
    userId: string;
    fullName: string;
    avatarUrl?: string | null;
}

export async function getProfile({ userId }: GetProfileParams) {
    const profile = await db
        .selectFrom('profiles')
        .selectAll()
        .where('id', '=', userId)
        .executeTakeFirst();

    return profile;
}

export async function createProfile({ userId, fullName, avatarUrl }: CreateProfileParams) {
    const profile = await db
        .insertInto('profiles')
        .values({
            id: userId,
            full_name: fullName,
            avatar_url: avatarUrl || null,
        })
        .returningAll()
        .executeTakeFirst();

    if (!profile) {
        throw new Error('Failed to create profile');
    }

    return profile;
} 