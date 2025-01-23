import Dexie from 'dexie';
import { db } from './db';
import { supabase } from './supabase';
import type { Profile, Organization, ProfileOrganizationMember, Ticket, TicketComment, OrganizationInvitation } from './db';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export const CURRENT_USER_KEY = 'currentUserId';
export const IS_INITIALIZED_KEY = 'isInitialized';

async function getCurrentUserId(): Promise<string | null> {
    const record = await db.system.get(CURRENT_USER_KEY);
    return record?.value || null;
}

async function setCurrentUserId(userId: string | null): Promise<void> {
    if (userId) {
        await db.system.put({ key: CURRENT_USER_KEY, value: userId });
    } else {
        await db.system.delete(CURRENT_USER_KEY);
    }
}

async function setInitialized(initialized: boolean): Promise<void> {
    if (initialized) {
        await db.system.put({ key: IS_INITIALIZED_KEY, value: 'true' });
    } else {
        await db.system.delete(IS_INITIALIZED_KEY);
    }
}

async function getLatestTimestamp(table: Dexie.Table<any, any>): Promise<string> {
    const latest = await table
        .orderBy('updated_at')
        .reverse()
        .limit(1)
        .first();

    return latest?.updated_at || '1970-01-01T00:00:00Z';
}

async function clearDatabase() {
    await db.transaction('rw', [
        db.profiles,
        db.organizations,
        db.profileOrganizationMembers,
        db.tickets,
        db.ticketComments,
        db.mutations
    ], async () => {
        await Promise.all([
            db.profiles.clear(),
            db.organizations.clear(),
            db.profileOrganizationMembers.clear(),
            db.tickets.clear(),
            db.ticketComments.clear(),
            db.mutations.clear()
        ]);
    });
}

export async function syncFromServer() {
    try {
        await setInitialized(false);
        // Get latest timestamps from local DB
        const [
            profilesTimestamp,
            organizationsTimestamp,
            membersTimestamp,
            ticketsTimestamp,
            commentsTimestamp
        ] = await Promise.all([
            getLatestTimestamp(db.profiles),
            getLatestTimestamp(db.organizations),
            getLatestTimestamp(db.profileOrganizationMembers),
            getLatestTimestamp(db.tickets),
            getLatestTimestamp(db.ticketComments)
        ]);

        // Fetch updated data from Supabase
        const [
            { data: profiles, error: profilesError },
            { data: organizations, error: orgsError },
            { data: members, error: membersError },
            { data: tickets, error: ticketsError },
            { data: comments, error: commentsError }
        ] = await Promise.all([
            supabase
                .from('profiles')
                .select('*')
                .gte('updated_at', profilesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('organizations')
                .select('*')
                .gte('updated_at', organizationsTimestamp)
                .is('deleted_at', null),
            supabase
                .from('profile_organization_members')
                .select('*')
                .gte('updated_at', membersTimestamp)
                .is('deleted_at', null),
            supabase
                .from('tickets')
                .select('*')
                .gte('updated_at', ticketsTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_comments')
                .select('*')
                .gte('updated_at', commentsTimestamp)
                .is('deleted_at', null)
        ]);

        // Check for errors
        if (profilesError) throw profilesError;
        if (orgsError) throw orgsError;
        if (membersError) throw membersError;
        if (ticketsError) throw ticketsError;
        if (commentsError) throw commentsError;

        // Update local DB
        await db.transaction('rw', [
            db.profiles,
            db.organizations,
            db.profileOrganizationMembers,
            db.tickets,
            db.ticketComments
        ], async () => {
            // Use bulkPut to upsert records
            if (profiles?.length) {
                await db.profiles.bulkPut(profiles as Profile[]);
            }
            if (organizations?.length) {
                await db.organizations.bulkPut(organizations as Organization[]);
            }
            if (members?.length) {
                await db.profileOrganizationMembers.bulkPut(members as ProfileOrganizationMember[]);
            }
            if (tickets?.length) {
                await db.tickets.bulkPut(tickets as Ticket[]);
            }
            if (comments?.length) {
                await db.ticketComments.bulkPut(comments as TicketComment[]);
            }
        });

        await setInitialized(true);
    } catch (error) {
        console.error('Error syncing from server:', error);
        throw error;
    }
}

export async function syncOrganizationData(organizationId: string) {
    try {
        // Get latest timestamps from local DB for org-specific data
        const [
            membersTimestamp,
            ticketsTimestamp,
            commentsTimestamp,
            invitationsTimestamp
        ] = await Promise.all([
            getLatestTimestamp(db.profileOrganizationMembers),
            getLatestTimestamp(db.tickets),
            getLatestTimestamp(db.ticketComments),
            getLatestTimestamp(db.organizationInvitations)
        ]);

        // Fetch updated data from Supabase for this organization
        const [
            { data: members, error: membersError },
            { data: tickets, error: ticketsError },
            { data: comments, error: commentsError },
            { data: invitations, error: invitationsError }
        ] = await Promise.all([
            supabase
                .from('profile_organization_members')
                .select('*')
                .eq('organization_id', organizationId)
                .gte('updated_at', membersTimestamp)
                .is('deleted_at', null),
            supabase
                .from('tickets')
                .select('*')
                .eq('organization_id', organizationId)
                .gte('updated_at', ticketsTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_comments')
                .select(`
                    id,
                    ticket_id,
                    user_id,
                    comment,
                    created_at,
                    updated_at,
                    deleted_at,
                    tickets!inner(organization_id)
                `)
                .eq('tickets.organization_id', organizationId)
                .gte('updated_at', commentsTimestamp)
                .is('deleted_at', null),
            supabase
                .from('organization_invitations')
                .select('*')
                .eq('organization_id', organizationId)
                .gte('updated_at', invitationsTimestamp)
                .is('deleted_at', null)
        ]);

        // Check for errors
        if (membersError) throw membersError;
        if (ticketsError) throw ticketsError;
        if (commentsError) throw commentsError;
        if (invitationsError) throw invitationsError;

        // Update local DB
        await db.transaction('rw', [
            db.profileOrganizationMembers,
            db.tickets,
            db.ticketComments,
            db.organizationInvitations
        ], async () => {
            if (members?.length) {
                await db.profileOrganizationMembers.bulkPut(members as ProfileOrganizationMember[]);
            }
            if (tickets?.length) {
                await db.tickets.bulkPut(tickets as Ticket[]);
            }
            if (comments?.length) {
                await db.ticketComments.bulkPut(comments as TicketComment[]);
            }
            if (invitations?.length) {
                await db.organizationInvitations.bulkPut(invitations as OrganizationInvitation[]);
            }
        });

    } catch (error) {
        console.error('Error syncing organization data:', error);
        throw error;
    }
}

let realtimeChannel: RealtimeChannel | null = null;

function setupRealtimeSync() {
    // Clean up existing subscription if any
    if (realtimeChannel) {
        realtimeChannel.unsubscribe();
    }

    // Set up real-time subscriptions for all tables
    realtimeChannel = supabase
        .channel('db-changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'profiles'
        }, async (payload: RealtimePostgresChangesPayload<Profile>) => {
            if (payload.eventType === 'DELETE') {
                await db.profiles.delete(payload.old.id);
            } else {
                await db.profiles.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'organizations'
        }, async (payload: RealtimePostgresChangesPayload<Organization>) => {
            if (payload.eventType === 'DELETE') {
                await db.organizations.delete(payload.old.id);
            } else {
                await db.organizations.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'profile_organization_members'
        }, async (payload: RealtimePostgresChangesPayload<ProfileOrganizationMember>) => {
            if (payload.eventType === 'DELETE') {
                await db.profileOrganizationMembers.delete(payload.old.id);
            } else {
                await db.profileOrganizationMembers.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'tickets'
        }, async (payload: RealtimePostgresChangesPayload<Ticket>) => {
            if (payload.eventType === 'DELETE') {
                await db.tickets.delete(payload.old.id);
            } else {
                await db.tickets.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_comments'
        }, async (payload: RealtimePostgresChangesPayload<TicketComment>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketComments.delete(payload.old.id);
            } else {
                await db.ticketComments.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'organization_invitations'
        }, async (payload: RealtimePostgresChangesPayload<OrganizationInvitation>) => {
            if (payload.eventType === 'DELETE') {
                await db.organizationInvitations.delete(payload.old.id);
            } else {
                await db.organizationInvitations.put(payload.new);
            }
        })
        .subscribe();
}

// Set up auth state change listener
supabase.auth.onAuthStateChange(async (event, session) => {
    const newUserId = session?.user.id || null;
    const currentUserId = await getCurrentUserId();

    if (event === 'SIGNED_IN') {
        // If there was a previous user, clear their data
        if (currentUserId && currentUserId !== newUserId) {
            await clearDatabase();
        }
        await setCurrentUserId(newUserId);
        await setInitialized(false);
        void syncFromServer();
        setupRealtimeSync();
    } else if (event === 'SIGNED_OUT') {
        // Clean up realtime subscription and initialization state
        realtimeChannel?.unsubscribe();
        realtimeChannel = null;
        await setInitialized(false);
    }
}); 