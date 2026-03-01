import { NextResponse } from 'next/server';
import { getServerDb } from '@/core/server-db';

export async function GET() {
    try {
        const db = await getServerDb();
        const res = await db.query(`SELECT case_id as id, title as name, 'active' as status, NOW() as "lastActive" FROM cases ORDER BY "lastActive" DESC`);

        return NextResponse.json({ success: true, cases: res.rows });
    } catch (error: unknown) {
        console.error('Failed to fetch cases:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const caseId = searchParams.get('id');

        if (!caseId) {
            return NextResponse.json({ error: 'Case ID is required' }, { status: 400 });
        }

        const db = await getServerDb();

        // Delete nodes and edges (assuming we don't have ON DELETE CASCADE setup in the DB schema for now)
        await db.query(`DELETE FROM graph_edges WHERE case_id = $1`, [caseId]);
        await db.query(`DELETE FROM graph_nodes WHERE case_id = $1`, [caseId]);
        await db.query(`DELETE FROM cases WHERE case_id = $1`, [caseId]);

        return NextResponse.json({ success: true, message: 'Case deleted successfully' });
    } catch (error: unknown) {
        console.error('Failed to delete case:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
