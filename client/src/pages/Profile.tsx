import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

export default function Profile() {
    const navigate = useNavigate()
    const { user, loading } = useAuth()

    const profile = useLiveQuery(
        async () => {
            if (!user) return null
            const result = await db.profiles.where('id').equals(user.id).first()
            return result ?? null
        },
        [user],
        null
    )

    if (loading) {
        return <div>Loading...</div>
    }

    if (!user) {
        return <div>Not authenticated</div>
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold">Welcome {profile?.full_name || 'Home'}</h1>
                    <Button onClick={handleSignOut} variant="outline">
                        Sign out
                    </Button>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
                    <div className="space-y-2">
                        <p><span className="font-medium">Email:</span> {user?.email}</p>
                        <p><span className="font-medium">Full Name:</span> {profile?.full_name || 'Not set'}</p>
                        <p><span className="font-medium">Avatar URL:</span> {profile?.avatar_url || 'Not set'}</p>
                        <p><span className="font-medium">User ID:</span> {user?.id}</p>
                        <p><span className="font-medium">Last Sign In:</span> {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    )
} 