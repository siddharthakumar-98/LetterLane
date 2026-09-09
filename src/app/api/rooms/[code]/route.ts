import { getPlayerId } from '@/lib/server/auth';
import { checkOrigin, failure, json, readBody } from '@/lib/server/http';
import { roomOperation } from '@/lib/server/rooms';
import { actionSchema, codeSchema } from '@/lib/game/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ code: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const code = codeSchema.parse((await context.params).code);
    return json(await roomOperation(code, await getPlayerId(request)));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const code = codeSchema.parse((await context.params).code);
    const action = actionSchema.parse(await readBody(request));
    return json(await roomOperation(code, await getPlayerId(request), action));
  } catch (error) {
    return failure(error);
  }
}
