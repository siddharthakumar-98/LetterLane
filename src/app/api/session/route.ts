import { isLocal } from '@/lib/server/db';
import { createLocalSession } from '@/lib/server/auth';
import { checkOrigin, failure, json } from '@/lib/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    if (isLocal()) return json({ backend: 'local' });
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
      throw new Error('Missing configuration');
    return json({
      backend: 'supabase',
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!isLocal()) return json({ backend: 'supabase' });
    return json({ id: await createLocalSession(request) });
  } catch (error) {
    return failure(error);
  }
}
