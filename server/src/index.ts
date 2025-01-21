import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './router';
import { createContext } from './context';
import { env } from './utils/env';

// Validate environment variables before starting the server
console.log(`Starting server in ${env.NODE_ENV} mode`);

const app = express();

app.use(cors());
app.use(express.json());

// tRPC middleware
app.use(
    '/trpc',
    createExpressMiddleware({
        router: appRouter,
        createContext,
    })
);

app.listen(env.PORT, () => {
    console.log(`🚀 Server listening on port ${env.PORT}`);
}); 