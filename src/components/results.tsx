'use client';
import Link from 'next/link';
import { ArrowRight, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import type { RoomView } from '@/lib/game/types';
import { PhraseRow } from './phrase-board';
import { playableLetters } from '@/lib/game/phrases';
import { Board } from './board';
import { BotTag } from './bot-notice';
export function formatTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function Results({
  room,
  busy,
  onRematch,
}: {
  room: RoomView;
  busy: boolean;
  onRematch: () => void;
}) {
  const phrases = room.game === 'phrases';
  const me = room.players.find((p) => p.id === room.selfId)!;
  const winner = room.players.find((p) => p.id === room.match.winnerId);
  const hasBot = room.players.some((p) => p.isBot);
  const teamWin = room.match.outcome === 'team-win';
  const title =
    room.mode === 'coop'
      ? teamWin
        ? 'A win for both of you.'
        : 'A good try, together.'
      : winner
        ? winner.id === room.selfId
          ? 'This lane is yours.'
          : `${winner.name} takes the lane.`
        : 'Great minds think alike.';
  return (
    <section className="results" aria-labelledby="result-title">
      <div className="result-celebration" aria-hidden="true">
        {room.match.outcome === 'team-loss' ? (
          <Sparkles size={32} />
        ) : (
          <Trophy size={32} />
        )}
      </div>
      <span className="eyebrow">ROUND {room.match.round} · COMPLETE</span>
      <h1 id="result-title" aria-live="polite">
        {title}
      </h1>
      <p className="result-description">
        {room.match.outcome === 'points'
          ? 'Decided by revealed letters and guess efficiency.'
          : room.match.outcome === 'draw'
            ? 'Same score. Shared bragging rights.'
            : room.match.outcome === 'team-loss'
              ? `Out of time or tries. A fresh ${phrases ? 'phrase' : 'word'} awaits.`
              : phrases
                ? 'One whole phrase. Well played.'
                : 'One little word. Well played.'}
      </p>
      <div className="answer-reveal">
        <span>{phrases ? 'THE PHRASE WAS' : 'THE WORD WAS'}</span>
        {phrases ? (
          <PhraseRow
            template={room.match.phraseTemplate!}
            letters={playableLetters(room.match.answer ?? '')}
            marks={Array(playableLetters(room.match.answer ?? '').length).fill(
              'correct',
            )}
          />
        ) : (
          <div>
            {[...(room.match.answer ?? '')].map((letter, i) => (
              <span className="tile correct" key={i}>
                {letter}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="result-players">
        {room.players.map((p) => (
          <article
            key={p.id}
            className={`result-player ${p.id === winner?.id || teamWin ? 'winner' : ''}`}
          >
            <div className="result-name">
              <div
                className={`avatar ${p.id === room.selfId ? 'sky' : 'periwinkle'}`}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <strong>
                {p.name}
                {p.id === room.selfId && <small>YOU</small>}
                {p.isBot && <BotTag />}
              </strong>
              {p.id === winner?.id && <Trophy size={18} />}
            </div>
            <div className="result-stats">
              <div>
                <strong>
                  {p.count}
                  <span> / 6</span>
                </strong>
                <small>
                  {p.solved
                    ? 'Solved'
                    : p.timedOut
                      ? 'Time ran out'
                      : 'Guesses'}
                </small>
              </div>
              <div>
                <strong>
                  {formatTime(p.attempts?.at(-1)?.elapsedMs ?? 0)}
                </strong>
                <small>Last guess</small>
              </div>
            </div>
            <Board
              compact
              template={room.match.phraseTemplate}
              attempts={p.attempts ?? []}
              label={`${p.name}'s revealed guesses`}
            />
          </article>
        ))}
      </div>
      <div className="results-actions">
        <button
          className="button primary"
          onClick={onRematch}
          disabled={busy || me.rematch}
        >
          <RotateCcw size={18} />
          {me.rematch
            ? 'Waiting for your friend…'
            : busy
              ? 'Getting ready…'
              : 'One more round'}
        </button>
        <Link href={phrases ? '/phrases' : '/'} className="text-button">
          Back to home
          <ArrowRight size={16} />
        </Link>
      </div>
      <p className="muted rematch-note">
        {hasBot
          ? `${room.players.find((p) => p.isBot)!.name} is ready for another round whenever you are.`
          : room.players.some((p) => p.rematch && p.id !== room.selfId)
            ? 'Your friend is ready for a rematch.'
            : `Same company. A new ${phrases ? 'phrase' : 'word'}. Both players choose to play again.`}
      </p>
    </section>
  );
}
