export interface AuthUser {
    id: string;
    email: string;
    role: string;
    fullName: string | null;
    organizations: Record<string, string>; // organizationId -> role mapping
} 