import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { DB } from './types'
import { env } from '../utils/env'

// Initialize Kysely with PostgreSQL
export const db = env.NODE_ENV === 'production' ? new Kysely<DB>({
    dialect: new PostgresDialect({
        pool: new Pool({
            connectionString: env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        })
    })
}) : new Kysely<DB>({
    dialect: new PostgresDialect({
        pool: new Pool({
            connectionString: env.DATABASE_URL,
        })
    })
})

// Re-export the DB type
export type { DB } from './types' 