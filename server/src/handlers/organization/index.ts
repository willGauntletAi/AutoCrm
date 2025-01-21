import { db } from '../../db';

export async function createOrganization(params: {
    name: string;
    userId: string;
}) {
    // Use a transaction to create both organization and member
    return await db.transaction().execute(async (trx) => {
        const organization = await trx
            .insertInto('organizations')
            .values({
                name: params.name,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // Create organization member record for the creator
        await trx
            .insertInto('profile_organization_members')
            .values({
                organization_id: organization.id,
                profile_id: params.userId,
                role: 'admin',
            })
            .execute();

        return organization;
    });
}

export async function getOrganizations(params: {
    userId: string;
}) {
    const result = await db
        .selectFrom('profile_organization_members')
        .innerJoin('organizations', 'organizations.id', 'profile_organization_members.organization_id')
        .select(['organizations.id', 'organizations.name', 'organizations.created_at'])
        .where('profile_organization_members.profile_id', '=', params.userId)
        .execute();

    return result;
} 