import { Bot } from 'lucide-react';
import { canPlayWithBot } from '@/lib/game/matchmaking';
import type { RoomView } from '@/lib/game/types';
import { BOT_PROFILES } from '@/lib/game/bot-difficulty';

export function BotTag() {
  return (
    <span className="bot-tag">
      <Bot size={13} aria-hidden="true" /> BOT
    </span>
  );
}

export function BotNotice({ room }: { room: RoomView }) {
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
  return (
    <div className="bot-notice">
      <Bot size={20} aria-hidden="true" />
      <div>
        <strong>Waiting for a second player</strong>
        <p>
          {canPlayWithBot(room, room.selfId)
            ? 'Keep waiting for a friend, or choose Play with bot to start now.'
            : 'Ready up to choose a bot, or wait for a friend to join.'}
        </p>
        <p>
          {profile.name} · {profile.label} difficulty
        </p>
      </div>
    </div>
  );
}
