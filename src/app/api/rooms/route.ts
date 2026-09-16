import { getPlayerId } from '@/lib/server/auth';
import { checkOrigin, failure, json, readBody } from '@/lib/server/http';
import { createRoom } from '@/lib/server/rooms';
import { createSchema } from '@/lib/game/validation';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = createSchema.parse(await readBody(request));
    const id = await getPlayerId(request);
    return json(
      await createRoom(id, input.name, input.mode, input.botDifficulty),
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
