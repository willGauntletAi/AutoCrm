import Dexie from 'dexie';
import { db } from './db';
import { supabase } from './supabase';
import type {
    Profile, Organization, ProfileOrganizationMember, Ticket, TicketComment, OrganizationInvitation, TicketTagKey, TicketTagNumberValueWithNumber, TicketTagTextValue, TicketTagDateValueWithDate, TicketTagDateValue, Macro, MacroChain,
    // Add draft types
    TicketDraft,
    TicketDraftComment,
    TicketDraftTagDateValue,
    TicketDraftTagNumberValue,
    TicketDraftTagTextValue,
    TicketDraftTagEnumValue,
    TicketTagEnumOption
} from './db';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { parseYMDDateString } from './utils';

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
        db.mutations,
        db.ticketTagKeys,
        db.ticketTagDateValues,
        db.ticketTagNumberValues,
        db.ticketTagTextValues,
        db.macros,
        db.macroChains,
        // Add draft tables
        db.ticketDrafts,
        db.ticketDraftComments,
        db.ticketDraftTagDateValues,
        db.ticketDraftTagNumberValues,
        db.ticketDraftTagTextValues,
        db.ticketDraftTagEnumValues,
        db.ticketTagEnumOptions
    ], async () => {
        await Promise.all([
            db.profiles.clear(),
            db.organizations.clear(),
            db.profileOrganizationMembers.clear(),
            db.tickets.clear(),
            db.ticketComments.clear(),
            db.mutations.clear(),
            db.ticketTagKeys.clear(),
            db.ticketTagDateValues.clear(),
            db.ticketTagNumberValues.clear(),
            db.ticketTagTextValues.clear(),
            db.macros.clear(),
            db.macroChains.clear(),
            // Add draft tables
            db.ticketDrafts.clear(),
            db.ticketDraftComments.clear(),
            db.ticketDraftTagDateValues.clear(),
            db.ticketDraftTagNumberValues.clear(),
            db.ticketDraftTagTextValues.clear(),
            db.ticketDraftTagEnumValues.clear(),
            db.ticketTagEnumOptions.clear()
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
            commentsTimestamp,
            invitationsTimestamp,
            tagKeysTimestamp,
            tagDateValuesTimestamp,
            tagNumberValuesTimestamp,
            tagTextValuesTimestamp,
            macrosTimestamp,
            macroChainsTimestamp,
            // Add draft timestamps
            draftsTimestamp,
            draftCommentsTimestamp,
            draftTagDateValuesTimestamp,
            draftTagNumberValuesTimestamp,
            draftTagTextValuesTimestamp,
            draftTagEnumValuesTimestamp,
            // Add enum options timestamp
            tagEnumOptionsTimestamp
        ] = await Promise.all([
            getLatestTimestamp(db.profiles),
            getLatestTimestamp(db.organizations),
            getLatestTimestamp(db.profileOrganizationMembers),
            getLatestTimestamp(db.tickets),
            getLatestTimestamp(db.ticketComments),
            getLatestTimestamp(db.organizationInvitations),
            getLatestTimestamp(db.ticketTagKeys),
            getLatestTimestamp(db.ticketTagDateValues),
            getLatestTimestamp(db.ticketTagNumberValues),
            getLatestTimestamp(db.ticketTagTextValues),
            getLatestTimestamp(db.macros),
            getLatestTimestamp(db.macroChains),
            // Add draft timestamps
            getLatestTimestamp(db.ticketDrafts),
            getLatestTimestamp(db.ticketDraftComments),
            getLatestTimestamp(db.ticketDraftTagDateValues),
            getLatestTimestamp(db.ticketDraftTagNumberValues),
            getLatestTimestamp(db.ticketDraftTagTextValues),
            getLatestTimestamp(db.ticketDraftTagEnumValues),
            // Add enum options timestamp
            getLatestTimestamp(db.ticketTagEnumOptions)
        ]);

        // Fetch updated data from Supabase
        const [
            { data: profiles, error: profilesError },
            { data: organizations, error: orgsError },
            { data: members, error: membersError },
            { data: tickets, error: ticketsError },
            { data: comments, error: commentsError },
            { data: invitations, error: invitationsError },
            { data: tagKeys, error: tagKeysError },
            { data: tagDateValues, error: tagDateValuesError },
            { data: tagNumberValues, error: tagNumberValuesError },
            { data: tagTextValues, error: tagTextValuesError },
            { data: macros, error: macrosError },
            { data: macroChains, error: macroChainsError },
            // Add draft queries
            { data: drafts, error: draftsError },
            { data: draftComments, error: draftCommentsError },
            { data: draftTagDateValues, error: draftTagDateValuesError },
            { data: draftTagNumberValues, error: draftTagNumberValuesError },
            { data: draftTagTextValues, error: draftTagTextValuesError },
            { data: draftTagEnumValues, error: draftTagEnumValuesError },
            // Add enum options query
            { data: tagEnumOptions, error: tagEnumOptionsError }
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
                .is('deleted_at', null),
            supabase
                .from('organization_invitations')
                .select('*')
                .gte('updated_at', invitationsTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_tag_keys')
                .select('*')
                .gte('updated_at', tagKeysTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_tag_date_values')
                .select('*')
                .gte('updated_at', tagDateValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_tag_number_values')
                .select('*')
                .gte('updated_at', tagNumberValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_tag_text_values')
                .select('*')
                .gte('updated_at', tagTextValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('macros')
                .select('*')
                .gte('updated_at', macrosTimestamp)
                .is('deleted_at', null),
            supabase
                .from('macro_chains')
                .select('*')
                .gte('updated_at', macroChainsTimestamp)
                .is('deleted_at', null),
            // Add draft queries
            supabase
                .from('ticket_drafts')
                .select('*')
                .gte('updated_at', draftsTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_comments')
                .select('*')
                .gte('updated_at', draftCommentsTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_tag_date_values')
                .select('*')
                .gte('updated_at', draftTagDateValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_tag_number_values')
                .select('*')
                .gte('updated_at', draftTagNumberValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_tag_text_values')
                .select('*')
                .gte('updated_at', draftTagTextValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_tag_enum_values')
                .select('*')
                .gte('updated_at', draftTagEnumValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_tag_enum_options')
                .select('*')
                .gte('updated_at', tagEnumOptionsTimestamp)
                .is('deleted_at', null)
        ]);

        // Check for errors
        if (profilesError) throw profilesError;
        if (orgsError) throw orgsError;
        if (membersError) throw membersError;
        if (ticketsError) throw ticketsError;
        if (commentsError) throw commentsError;
        if (invitationsError) throw invitationsError;
        if (tagKeysError) throw tagKeysError;
        if (tagDateValuesError) throw tagDateValuesError;
        if (tagNumberValuesError) throw tagNumberValuesError;
        if (tagTextValuesError) throw tagTextValuesError;
        if (macrosError) throw macrosError;
        if (macroChainsError) throw macroChainsError;
        // Add draft error checks
        if (draftsError) throw draftsError;
        if (draftCommentsError) throw draftCommentsError;
        if (draftTagDateValuesError) throw draftTagDateValuesError;
        if (draftTagNumberValuesError) throw draftTagNumberValuesError;
        if (draftTagTextValuesError) throw draftTagTextValuesError;
        if (draftTagEnumValuesError) throw draftTagEnumValuesError;
        if (tagEnumOptionsError) throw tagEnumOptionsError;

        // Update local DB
        await db.transaction('rw', [
            db.profiles,
            db.organizations,
            db.profileOrganizationMembers,
            db.tickets,
            db.ticketComments,
            db.organizationInvitations,
            db.ticketTagKeys,
            db.ticketTagDateValues,
            db.ticketTagNumberValues,
            db.ticketTagTextValues,
            db.macros,
            db.macroChains,
            // Add draft tables
            db.ticketDrafts,
            db.ticketDraftComments,
            db.ticketDraftTagDateValues,
            db.ticketDraftTagNumberValues,
            db.ticketDraftTagTextValues,
            db.ticketDraftTagEnumValues,
            // Add enum options table
            db.ticketTagEnumOptions
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
            if (invitations?.length) {
                await db.organizationInvitations.bulkPut(invitations as OrganizationInvitation[]);
            }
            if (tagKeys?.length) {
                await db.ticketTagKeys.bulkPut(tagKeys as TicketTagKey[]);
            }
            if (tagDateValues?.length) {
                await db.ticketTagDateValues.bulkPut(tagDateValues.map(t => ({ ...t, value: new Date(t.value) })) as TicketTagDateValueWithDate[]);
            }
            if (tagNumberValues?.length) {
                await db.ticketTagNumberValues.bulkPut(tagNumberValues as TicketTagNumberValueWithNumber[]);
            }
            if (tagTextValues?.length) {
                await db.ticketTagTextValues.bulkPut(tagTextValues as TicketTagTextValue[]);
            }
            if (macros?.length) {
                await db.macros.bulkPut(macros as Macro[]);
            }
            if (macroChains?.length) {
                await db.macroChains.bulkPut(macroChains as MacroChain[]);
            }
            // Add draft updates
            if (drafts?.length) {
                await db.ticketDrafts.bulkPut(drafts.map(draft => ({
                    ...draft,
                    parent_draft_id: draft.parent_draft_id ?? null,
                    latency: draft.latency ?? 0
                })) as TicketDraft[]);
            }
            if (draftComments?.length) {
                await db.ticketDraftComments.bulkPut(draftComments as TicketDraftComment[]);
            }
            if (draftTagDateValues?.length) {
                await db.ticketDraftTagDateValues.bulkPut(draftTagDateValues.map(t => ({ ...t, value: new Date(t.value) })) as TicketDraftTagDateValue[]);
            }
            if (draftTagNumberValues?.length) {
                await db.ticketDraftTagNumberValues.bulkPut(draftTagNumberValues as TicketDraftTagNumberValue[]);
            }
            if (draftTagTextValues?.length) {
                await db.ticketDraftTagTextValues.bulkPut(draftTagTextValues as TicketDraftTagTextValue[]);
            }
            if (draftTagEnumValues?.length) {
                await db.ticketDraftTagEnumValues.bulkPut(draftTagEnumValues as TicketDraftTagEnumValue[]);
            }
            if (tagEnumOptions?.length) {
                await db.ticketTagEnumOptions.bulkPut(tagEnumOptions);
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
            invitationsTimestamp,
            // Add draft timestamps
            draftsTimestamp,
            draftCommentsTimestamp,
            draftTagDateValuesTimestamp,
            draftTagNumberValuesTimestamp,
            draftTagTextValuesTimestamp,
            draftTagEnumValuesTimestamp
        ] = await Promise.all([
            getLatestTimestamp(db.profileOrganizationMembers),
            getLatestTimestamp(db.tickets),
            getLatestTimestamp(db.ticketComments),
            getLatestTimestamp(db.organizationInvitations),
            // Add draft timestamps
            getLatestTimestamp(db.ticketDrafts),
            getLatestTimestamp(db.ticketDraftComments),
            getLatestTimestamp(db.ticketDraftTagDateValues),
            getLatestTimestamp(db.ticketDraftTagNumberValues),
            getLatestTimestamp(db.ticketDraftTagTextValues),
            getLatestTimestamp(db.ticketDraftTagEnumValues)
        ]);

        // Fetch updated data from Supabase for this organization
        const [
            { data: members, error: membersError },
            { data: tickets, error: ticketsError },
            { data: comments, error: commentsError },
            { data: invitations, error: invitationsError },
            // Add draft queries
            { data: drafts, error: draftsError },
            { data: draftComments, error: draftCommentsError },
            { data: draftTagDateValues, error: draftTagDateValuesError },
            { data: draftTagNumberValues, error: draftTagNumberValuesError },
            { data: draftTagTextValues, error: draftTagTextValuesError },
            { data: draftTagEnumValues, error: draftTagEnumValuesError }
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
                .is('deleted_at', null),
            // Add draft queries
            supabase
                .from('ticket_drafts')
                .select('*')
                .eq('organization_id', organizationId)
                .gte('updated_at', draftsTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_comments')
                .select(`
                    id,
                    ticket_draft_id,
                    user_id,
                    comment,
                    created_at,
                    updated_at,
                    deleted_at,
                    ticket_drafts!inner(organization_id)
                `)
                .eq('ticket_drafts.organization_id', organizationId)
                .gte('updated_at', draftCommentsTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_tag_date_values')
                .select(`
                    id,
                    ticket_draft_id,
                    tag_key_id,
                    value,
                    created_at,
                    updated_at,
                    deleted_at,
                    ticket_drafts!inner(organization_id)
                `)
                .eq('ticket_drafts.organization_id', organizationId)
                .gte('updated_at', draftTagDateValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_tag_number_values')
                .select(`
                    id,
                    ticket_draft_id,
                    tag_key_id,
                    value,
                    created_at,
                    updated_at,
                    deleted_at,
                    ticket_drafts!inner(organization_id)
                `)
                .eq('ticket_drafts.organization_id', organizationId)
                .gte('updated_at', draftTagNumberValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_tag_text_values')
                .select(`
                    id,
                    ticket_draft_id,
                    tag_key_id,
                    value,
                    created_at,
                    updated_at,
                    deleted_at,
                    ticket_drafts!inner(organization_id)
                `)
                .eq('ticket_drafts.organization_id', organizationId)
                .gte('updated_at', draftTagTextValuesTimestamp)
                .is('deleted_at', null),
            supabase
                .from('ticket_draft_tag_enum_values')
                .select(`
                    id,
                    ticket_draft_id,
                    tag_key_id,
                    enum_option_id,
                    created_at,
                    updated_at,
                    deleted_at,
                    ticket_drafts!inner(organization_id)
                `)
                .eq('ticket_drafts.organization_id', organizationId)
                .gte('updated_at', draftTagEnumValuesTimestamp)
                .is('deleted_at', null)
        ]);

        // Check for errors
        if (membersError) throw membersError;
        if (ticketsError) throw ticketsError;
        if (commentsError) throw commentsError;
        if (invitationsError) throw invitationsError;
        // Add draft error checks
        if (draftsError) throw draftsError;
        if (draftCommentsError) throw draftCommentsError;
        if (draftTagDateValuesError) throw draftTagDateValuesError;
        if (draftTagNumberValuesError) throw draftTagNumberValuesError;
        if (draftTagTextValuesError) throw draftTagTextValuesError;
        if (draftTagEnumValuesError) throw draftTagEnumValuesError;

        // Update local DB
        await db.transaction('rw', [
            db.profileOrganizationMembers,
            db.tickets,
            db.ticketComments,
            db.organizationInvitations,
            // Add draft tables
            db.ticketDrafts,
            db.ticketDraftComments,
            db.ticketDraftTagDateValues,
            db.ticketDraftTagNumberValues,
            db.ticketDraftTagTextValues,
            db.ticketDraftTagEnumValues
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
            // Add draft updates
            if (drafts?.length) {
                await db.ticketDrafts.bulkPut(drafts.map(draft => ({
                    ...draft,
                    parent_draft_id: draft.parent_draft_id ?? null,
                    latency: draft.latency ?? 0
                })) as TicketDraft[]);
            }
            if (draftComments?.length) {
                await db.ticketDraftComments.bulkPut(draftComments as TicketDraftComment[]);
            }
            if (draftTagDateValues?.length) {
                await db.ticketDraftTagDateValues.bulkPut(draftTagDateValues.map(t => ({ ...t, value: new Date(t.value) })) as TicketDraftTagDateValue[]);
            }
            if (draftTagNumberValues?.length) {
                await db.ticketDraftTagNumberValues.bulkPut(draftTagNumberValues as TicketDraftTagNumberValue[]);
            }
            if (draftTagTextValues?.length) {
                await db.ticketDraftTagTextValues.bulkPut(draftTagTextValues as TicketDraftTagTextValue[]);
            }
            if (draftTagEnumValues?.length) {
                await db.ticketDraftTagEnumValues.bulkPut(draftTagEnumValues as TicketDraftTagEnumValue[]);
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

            try {
                if (payload.eventType === 'DELETE') {
                    await db.organizationInvitations.delete(payload.old.id);
                } else {
                    await db.organizationInvitations.put(payload.new);
                }
            } catch (error) {
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_tag_keys'
        }, async (payload: RealtimePostgresChangesPayload<TicketTagKey>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketTagKeys.delete(payload.old.id);
            } else {
                await db.ticketTagKeys.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_tag_date_values'
        }, async (payload: RealtimePostgresChangesPayload<TicketTagDateValue>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketTagDateValues.delete(payload.old.id);
            } else {
                const newDateValue = { ...payload.new, value: parseYMDDateString(payload.new.value) };
                await db.ticketTagDateValues.put(newDateValue);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_tag_number_values'
        }, async (payload: RealtimePostgresChangesPayload<TicketTagNumberValueWithNumber>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketTagNumberValues.delete(payload.old.id);
            } else {
                await db.ticketTagNumberValues.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_tag_text_values'
        }, async (payload: RealtimePostgresChangesPayload<TicketTagTextValue>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketTagTextValues.delete(payload.old.id);
            } else {
                await db.ticketTagTextValues.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'macros'
        }, async (payload: RealtimePostgresChangesPayload<Macro>) => {
            if (payload.eventType === 'DELETE') {
                await db.macros.delete(payload.old.id);
            } else {
                await db.macros.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'macro_chains'
        }, async (payload: RealtimePostgresChangesPayload<MacroChain>) => {
            if (payload.eventType === 'DELETE') {
                await db.macroChains.delete(payload.old.id);
            } else {
                await db.macroChains.put(payload.new);
            }
        })
        // Add draft subscriptions
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_drafts'
        }, async (payload: RealtimePostgresChangesPayload<TicketDraft>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketDrafts.delete(payload.old.id);
            } else {
                await db.ticketDrafts.put({
                    ...payload.new,
                    parent_draft_id: payload.new.parent_draft_id ?? null,
                    latency: payload.new.latency ?? 0
                });
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_draft_comments'
        }, async (payload: RealtimePostgresChangesPayload<TicketDraftComment>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketDraftComments.delete(payload.old.id);
            } else {
                await db.ticketDraftComments.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_draft_tag_date_values'
        }, async (payload: RealtimePostgresChangesPayload<TicketDraftTagDateValue>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketDraftTagDateValues.delete(payload.old.id);
            } else {
                const newDateValue = { ...payload.new, value: new Date(payload.new.value) };
                await db.ticketDraftTagDateValues.put(newDateValue);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_draft_tag_number_values'
        }, async (payload: RealtimePostgresChangesPayload<TicketDraftTagNumberValue>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketDraftTagNumberValues.delete(payload.old.id);
            } else {
                await db.ticketDraftTagNumberValues.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_draft_tag_text_values'
        }, async (payload: RealtimePostgresChangesPayload<TicketDraftTagTextValue>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketDraftTagTextValues.delete(payload.old.id);
            } else {
                await db.ticketDraftTagTextValues.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_draft_tag_enum_values'
        }, async (payload: RealtimePostgresChangesPayload<TicketDraftTagEnumValue>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketDraftTagEnumValues.delete(payload.old.id);
            } else {
                await db.ticketDraftTagEnumValues.put(payload.new);
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ticket_tag_enum_options'
        }, async (payload: RealtimePostgresChangesPayload<TicketTagEnumOption>) => {
            if (payload.eventType === 'DELETE') {
                await db.ticketTagEnumOptions.delete(payload.old.id);
            } else {
                await db.ticketTagEnumOptions.put(payload.new);
            }
        })
        .subscribe();

    return realtimeChannel;
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