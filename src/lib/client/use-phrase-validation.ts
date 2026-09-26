'use client';
import { useEffect, useState } from 'react';
import { completedPhraseWords, invalidWordMessage } from '../game/phrases';
import { api } from './api';

export function usePhraseValidation(
  template: string | undefined,
  letters: string,
  enabled: boolean,
) {
  const [cache, setCache] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );
  const completed =
    enabled && template ? completedPhraseWords(template, letters) : [];
  // Adding letters to an incomplete word does not restart completed-word checks.
  const signature = JSON.stringify([
    ...new Set(completed.map(({ word }) => word)),
  ]);
  useEffect(() => {
    const words = JSON.parse(signature) as string[];
    const unchecked = words.filter((word) => !cache.has(word));
    if (!unchecked.length) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void api<{ valid: boolean[] }>('/api/phrases/validate', {
        words: unchecked,
      })
        .then(({ valid }) => {
          if (
            cancelled ||
            valid.length !== unchecked.length ||
            valid.some((value) => typeof value !== 'boolean')
          )
            return;
          setCache((previous) => {
            const next = new Map(previous);
            unchecked.forEach((word, index) => next.set(word, valid[index]));
            // Bound session memory without shipping the dictionary to clients.
            while (next.size > 256) next.delete(next.keys().next().value!);
            return next;
          });
        })
        // Live feedback is advisory. A failed check never bypasses submission validation.
        .catch(() => {});
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [signature, cache]);

  return invalidWordMessage(
    completed.flatMap(({ position, word }) =>
      cache.get(word) === false ? [position] : [],
    ),
  );
}
