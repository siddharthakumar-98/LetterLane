import { Bot, Timer } from 'lucide-react';
import { BOT_WAIT_MS } from '@/lib/game/matchmaking';
import type { RoomView } from '@/lib/game/types';
import { BOT_PROFILES } from '@/lib/game/bot-difficulty';

export function BotTag() {
  return (
    <span className="bot-tag">
      <Bot size={13} aria-hidden="true" /> BOT
    </span>
  );
}

export function BotNotice({ room, now }: { room: RoomView; now: number }) {
  const profile = BOT_PROFILES[room.botDifficulty ?? 'hard'];
  const bot = room.players.find((player) => player.isBot);
  if (bot)
    return (
      <div className="bot-notice bot-arrived" role="status">
        <Bot size={20} aria-hidden="true" />
        <div>
          <strong>
            {room.mode === 'coop'
              ? `${bot.name} is your bot teammate.`
              : `${bot.name} is your bot opponent.`}
          </strong>
          <p>
            {profile.label} difficulty. Same six chances. Its own clues. Ready
            when you are.
          </p>
        </div>
      </div>
    );
  if (room.players.length !== 1) return null;
  const seconds = Math.max(
    0,
    Math.ceil(
      (room.createdAt + BOT_WAIT_MS - Math.max(now, room.serverTime)) / 1000,
    ),
  );
  return (
    <div className="bot-notice">
      <Timer size={20} aria-hidden="true" />
      <div>
        <strong>Waiting for a second player</strong>
        <p aria-hidden="true">
          {seconds > 0
            ? `A bot joins in ${seconds}s if no one arrives.`
            : 'Bringing in your bot companion…'}
        </p>
        <span className="sr-only">
          A bot joins after 45 seconds if no second player arrives.
        </span>
        <p>
          {profile.name} · {profile.label} difficulty
        </p>
      </div>
    </div>
  );
}
