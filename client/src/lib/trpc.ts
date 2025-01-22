import { createTRPCProxyClient, createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '../../../server/src/router';
import { supabase } from './supabase';

export const trpc = createTRPCReact<AppRouter>();

export const client = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: import.meta.env.PROD ? 'https://main.d3ldm7n78gdygc.amplifyapp.com/trpc' : 'http://localhost:3000/trpc',
            async headers() {
                const { data: { session } } = await supabase.auth.getSession()
                console.log(session)
                return {
                    authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
                }
            },
        }),
    ],
});