import { createContext, useContext } from 'react'
import { User } from '@supabase/supabase-js'
import { Database } from '../types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface ProfileContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
}

export const ProfileContext = createContext<ProfileContextType>({
    user: null,
    profile: null,
    loading: true,
})

export const useProfile = () => {
    const context = useContext(ProfileContext)
    if (context === undefined) {
        throw new Error('useProfile must be used within a ProfileProvider')
    }
    return context
} 