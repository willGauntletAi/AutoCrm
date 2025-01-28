import { z } from 'zod';

const envSchema = z.object({
    // Database configuration
    DATABASE_URL: z.string().url(),
    // Supabase configuration
    SUPABASE_URL: z.string().url(),
    SUPABASE_JWT_SECRET: z.string(),
    // OpenAI configuration
    OPENAI_API_KEY: z.string(),
    // Server configuration
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missingVars = error.issues.map(issue => {
                return `${issue.path.join('.')}: ${issue.message}`;
            });
            console.error('❌ Invalid environment variables:', missingVars.join('\n'));
            throw new Error('Invalid environment variables');
        }
        throw error;
    }
}

export const env = validateEnv(); 