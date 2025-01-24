import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import { trpc } from './lib/trpc'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import CreateProfile from './pages/CreateProfile'
import Organizations from './pages/Organizations'
import ProtectedRoute from './components/ProtectedRoute'
import { supabase } from './lib/supabase'
import Tickets from './pages/Tickets'
import Ticket from './pages/Ticket'
import OrganizationLayout from './components/OrganizationLayout'
import EmployeesPage from './pages/Employees'
import AdminPage from './pages/Admin'

function App() {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: import.meta.env.PROD ? 'https://main.d3ldm7n78gdygc.amplifyapp.com/trpc' : 'http://localhost:3000/trpc',
          // You can pass any HTTP headers you wish here
          async headers() {
            const { data: { session } } = await supabase.auth.getSession()
            console.log(session)
            return {
              authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
            }
          },
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/create-profile"
              element={
                <ProtectedRoute>
                  <CreateProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Organizations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            {/* Organization Routes */}
            <Route
              path="/:organization_id"
              element={
                <ProtectedRoute>
                  <OrganizationLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<div>Dashboard (Coming Soon)</div>} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="tickets/:ticket_id" element={<Ticket />} />
              <Route path="customers" element={<div>Customers (Coming Soon)</div>} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  )
}

export default App
