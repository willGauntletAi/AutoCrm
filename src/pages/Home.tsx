import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

export default function Home() {
    const navigate = useNavigate()
    const [user, setUser] = useState<User | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
        })
    }, [])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold">Welcome Home</h1>
                    <Button onClick={handleSignOut} variant="outline">
                        Sign out
                    </Button>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
                    <div className="space-y-2">
                        <p><span className="font-medium">Email:</span> {user?.email}</p>
                        <p><span className="font-medium">User ID:</span> {user?.id}</p>
                        <p><span className="font-medium">Last Sign In:</span> {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    )
} 