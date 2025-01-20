import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './router';
import { createContext } from './context';

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 