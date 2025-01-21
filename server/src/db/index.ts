import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { DB } from './types'

// Initialize Kysely with PostgreSQL
export const db = new Kysely<DB>({
    dialect: new PostgresDialect({
        pool: new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        })
    })
})

// Re-export the DB type
export type { DB } from './types' 