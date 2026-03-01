import fs from 'fs';
import path from 'path';
import { initSovereignDb } from './sovereign/db/sovereign-db-init';
import type { PgLiteLike } from './sovereign';

let dbInstance: PgLiteLike | null = null;

/**
 * Returns a globally cached connection to the Sovereign Database.
 * If process.env.DATABASE_URL is set, this returns a real PostgreSQL Pool connection.
 * Otherwise, it falls back to an in-memory PGLite instance (for local dev without docker).
 */
export async function getServerDb(): Promise<PgLiteLike> {
    if (dbInstance) return dbInstance;

    try {
        const schemaDir = path.join(process.cwd(), 'src', 'core', 'sovereign', 'schema');

        // Read schema strings directly from the filesystem (server process only)
        const v1 = fs.readFileSync(path.join(schemaDir, 'sovereign-schema-v1.sql'), 'utf-8');
        const v2 = fs.readFileSync(path.join(schemaDir, 'sovereign-schema-v2.sql'), 'utf-8');
        const v3 = fs.readFileSync(path.join(schemaDir, 'sovereign-schema-v3.sql'), 'utf-8');
        const v4 = fs.readFileSync(path.join(schemaDir, 'sovereign-schema-v4.sql'), 'utf-8');

        dbInstance = await initSovereignDb(v1, {
            schemaVersion: 4,
            schemaSqlV2: v2,
            schemaSqlV3: v3,
            schemaSqlV4: v4,
        });

        console.log("✅ Sovereign DB Instance Initialised Server-Side.");
        return dbInstance;
    } catch (error) {
        console.error("❌ Failed to initialise Server DB:", error);
        throw error;
    }
}
