import { useParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';

export function useOrganization() {
    const { organization_id } = useParams<{ organization_id: string }>();
    const { data: organizations } = trpc.getOrganizations.useQuery();

    const organization = organizations?.find(org => org.id === organization_id);

    return { organization };
} 
