import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  normalizePhrase,
  playableLetters,
  phraseTemplate,
  phraseWords,
  phraseMetadata,
  phraseEntry,
  formatPhraseGuess,
  samePhrase,
  scorePhrase,
  validatePhraseGuess,
  invalidWordMessage,
  isAllowedPhraseWord,
  completedPhraseWords,
} from '../src/lib/game/phrases';
import { PHRASES, PHRASE_WORDS, pickPhrase } from '../src/lib/server/phrases';
import { choosePhraseBotGuess } from '../src/lib/server/phrase-bot';
import {
  applyAction,
  projectRoom,
  advance,
  solved,
} from '../src/lib/game/rules';
import { advanceBots } from '../src/lib/server/bots';
import { roundDeadline, timeBonus } from '../src/lib/game/round-clock';
import { createSchema } from '../src/lib/game/validation';
import { keyboardMarks } from '../src/lib/game/scoring';
import type { Attempt, Room } from '../src/lib/game/types';
import { fixture, p1 } from './fixtures';

export function phraseRoom(answer = 'ACTIONS SPEAK LOUDER THAN WORDS'): Room {
  const room = fixture();
  room.game = 'phrases';
  room.match.answer = answer;
  return room;
}
const guess = (room: Room, word: string, now = 4000) =>
  applyAction(
    room,
    p1,
    { type: 'guess', word, matchId: room.match.id, requestId: randomUUID() },
    now,
    PHRASE_WORDS,
    () => "A LEOPARD CAN'T CHANGE ITS SPOTS",
    randomUUID,
  );

describe('phrase normalization and dataset', () => {
  it('keeps punctuation visible without playable slots or extra words', () => {
    expect(normalizePhrase('  A  leopard CAN’T\nchange its spots. ')).toBe(
      "A LEOPARD CAN'T CHANGE ITS SPOTS.",
    );
    expect(phraseMetadata("A leopard can't change its spots")).toEqual({
      wordCount: 6,
      letterCount: 26,
    });
    expect(phraseTemplate("A leopard can't change its spots.")).toBe(
      "_ _______ ___'_ ______ ___ _____.",
    );
    expect(
      formatPhraseGuess(
        "_ _______ ___'_ ______ ___ _____.",
        'ALEOPARDCANTCHANGEITSSPOTS',
      ),
    ).toBe("A LEOPARD CAN'T CHANGE ITS SPOTS.");
    expect(
      samePhrase(
        "A leopard can't change its spots.",
        'ALEOPARDCANTCHANGEITSSPOTS',
      ),
    ).toBe(true);
    expect(
      phraseWords('A WELL-KNOWN SAYING.').map((word) => word.length),
    ).toEqual([1, 9, 6]);
  });
  it('has clean unique metadata-rich entries of at most seven words', () => {
    expect(PHRASES.length).toBeGreaterThan(30);
    expect(new Set(PHRASES.map((p) => p.id)).size).toBe(PHRASES.length);
    for (const entry of PHRASES) {
      expect(entry.wordCount).toBeLessThanOrEqual(7);
      expect(entry).toMatchObject(phraseMetadata(entry.text));
      expect(entry.text).not.toMatch(/[\[\]()\n]/);
      expect(
        validatePhraseGuess(
          playableLetters(entry.text),
          phraseTemplate(entry.text),
          PHRASE_WORDS,
        ),
      ).toBe(playableLetters(entry.text));
    }
    expect(
      PHRASES.some((p) => p.text === 'ACTIONS SPEAK LOUDER THAN WORDS'),
    ).toBe(true);
    expect(
      PHRASES.some((p) => p.text === "A LEOPARD CAN'T CHANGE ITS SPOTS"),
    ).toBe(true);
    expect(
      phraseEntry(
        'A journey of a thousand miles begins with a single step',
        'test',
      ),
    ).toBeNull();
    expect(
      phraseEntry('Beauty is in the eye of the beholder', 'test'),
    ).toBeNull();
    expect(phraseEntry('Broken [2] entry', 'test')).toBeNull();
  });
  it('randomly selects locally and never repeats the immediately previous phrase', () => {
    for (let i = 0; i < 25; i++) {
      const first = pickPhrase();
      expect(PHRASES.some((p) => p.text === first)).toBe(true);
      expect(pickPhrase(first)).not.toBe(first);
    }
  });
});
describe('four-color evaluation', () => {
  it('supports green, orange, blue and grey in one guess', () => {
    expect(scorePhrase('CAT BAG TIME', 'TAR CAB TIME')).toEqual([
      'present',
      'correct',
      'absent',
      'elsewhere',
      'correct',
      'present',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
    expect(scorePhrase('AB CD', 'CD AB')).toEqual(Array(4).fill('elsewhere'));
  });
  it('reserves all exact and same-word matches before cross-word duplicates', () => {
    expect(scorePhrase('AB BA', 'AA AB')).toEqual([
      'correct',
      'absent',
      'present',
      'present',
    ]);
    expect(scorePhrase('AA BB', 'AA AA')).toEqual([
      'correct',
      'correct',
      'absent',
      'absent',
    ]);
    expect(scorePhrase("A CAT'S NAP.", 'ACATSNAP')).toEqual(
      Array(8).fill('correct'),
    );
    for (let a = 0; a < 16; a++)
      for (let g = 0; g < 16; g++) {
        const answer = a
          .toString(2)
          .padStart(4, '0')
          .replaceAll('0', 'A')
          .replaceAll('1', 'B');
        const entered = g
          .toString(2)
          .padStart(4, '0')
          .replaceAll('0', 'A')
          .replaceAll('1', 'B');
        const marks = scorePhrase(
          `${answer.slice(0, 2)} ${answer.slice(2)}`,
          entered,
        );
        for (const letter of ['A', 'B'])
          expect(
            marks.filter(
              (mark, i) => entered[i] === letter && mark !== 'absent',
            ).length,
          ).toBeLessThanOrEqual([...answer].filter((c) => c === letter).length);
        marks.forEach((mark, i) =>
          expect(mark === 'correct').toBe(answer[i] === entered[i]),
        );
      }
  });
  it('handles keyboard precedence and phrase-only clock bonuses', () => {
    expect(
      keyboardMarks([
        { word: 'AAAA', marks: ['absent', 'elsewhere', 'present', 'correct'] },
      ]),
    ).toEqual({ A: 'correct' });
    expect(
      timeBonus(['correct', 'present', 'elsewhere', 'absent'], 'phrases'),
    ).toBe(15000);
    expect(timeBonus(['correct', 'present'], 'words')).toBe(40000);
    expect(roundDeadline(1000, [], 'phrases')).toBe(181000);
    expect(roundDeadline(1000, [])).toBe(91000);
  });
});
describe('per-word validation', () => {
  it.each([
    'LUNG',
    'ROAD',
    'ROOM',
    'PLAN',
    'ELSE',
    'CAPTION',
    'MOTHER',
    'COLOUR',
    'COLOR',
    'ORGANISE',
    'ORGANIZE',
    "CAN'T",
    "DON'T",
    "IT'S",
    'WELL-KNOWN',
    'ROAD.',
  ])('accepts ordinary vocabulary and supported punctuation: %s', (word) => {
    expect(isAllowedPhraseWord(word, PHRASE_WORDS)).toBe(true);
  });
  it.each([
    'GOS',
    'NIFFS',
    'BAUK',
    'JS',
    'QOPH',
    'QAT',
    'ZA',
    'XU',
    'AAL',
    'XIX',
    'CPU',
    'HTML',
    'ETC',
    'ZZZZ',
    'RO4D',
    'R O A D',
    '-ROAD',
    'ROAD--ROOM',
    '',
  ])(
    'rejects game artifacts, abbreviations and malformed tokens: %s',
    (word) => {
      expect(isAllowedPhraseWord(word, PHRASE_WORDS)).toBe(false);
    },
  );
  it('keeps every answer word eligible for independent live checks', () => {
    for (const phrase of PHRASES) {
      for (const { pattern } of phraseWords(phrase.text)) {
        expect(isAllowedPhraseWord(pattern, PHRASE_WORDS), pattern).toBe(true);
      }
    }
  });
  it('uses the stricter policy for full submissions, not just the live endpoint', () => {
    expect(() =>
      validatePhraseGuess(
        'GOS NIFFS BAUK JS LUNG',
        '___ _____ ____ __ ____',
        PHRASE_WORDS,
      ),
    ).toThrow('Words 1, 2, 3, and 4 are not in word list');
    expect(() =>
      validatePhraseGuess(
        'ACTIONS NIFFS LOUDER THAN WORDS',
        '_______ _____ ______ ____ _____',
        PHRASE_WORDS,
      ),
    ).toThrow('Word 2 is not in word list');
    expect(
      validatePhraseGuess('CANTDONTITS', "___'_ ___'_ __'_", PHRASE_WORDS),
    ).toBe('CANTDONTITS');
    expect(
      validatePhraseGuess('WELLKNOWNROAD', '____-_____ ____.', PHRASE_WORDS),
    ).toBe('WELLKNOWNROAD');
  });
  it('extracts only complete words, with their template punctuation and positions', () => {
    const template = "___ ___'_ ____-_____.";
    expect(completedPhraseWords(template, 'CA')).toEqual([]);
    expect(completedPhraseWords(template, 'CATDO')).toEqual([
      { position: 1, word: 'CAT' },
    ]);
    expect(completedPhraseWords(template, 'CATDONTWELLKNOWN')).toEqual([
      { position: 1, word: 'CAT' },
      { position: 2, word: "DON'T" },
      { position: 3, word: 'WELL-KNOWN.' },
    ]);
    expect(completedPhraseWords(template, 'CATDON')).toEqual([
      { position: 1, word: 'CAT' },
    ]);
  });
  it.each([
    [[2], 'Word 2 is not in word list'],
    [[1, 3], 'Words 1 and 3 are not in word list'],
    [[1, 2, 5], 'Words 1, 2, and 5 are not in word list'],
    [
      [1, 2, 3, 4, 5, 6, 7],
      'Words 1, 2, 3, 4, 5, 6, and 7 are not in word list',
    ],
  ] as const)('formats invalid positions %s', (indices, message) =>
    expect(invalidWordMessage([...indices])).toBe(message),
  );
  it('validates all words before scoring and accepts punctuation and hyphens', () => {
    const allowed = new Set(['CAT', 'DOG', 'WELL', 'KNOWN', 'SAYING', 'A']);
    expect(() =>
      validatePhraseGuess('CATZZZDOG', '___ ___ ___', allowed),
    ).toThrow('Word 2 is not in word list');
    expect(() =>
      validatePhraseGuess('ZZZDOGZZZ', '___ ___ ___', allowed),
    ).toThrow('Words 1 and 3 are not in word list');
    expect(() =>
      validatePhraseGuess('ZZZZZZZZZ', '___ ___ ___', allowed),
    ).toThrow('Words 1, 2, and 3 are not in word list');
    expect(
      validatePhraseGuess('AWELLKNOWNSAYING', '_ ____-_____ ______.', allowed),
    ).toBe('AWELLKNOWNSAYING');
    expect(() => validatePhraseGuess('A', '_ _______', allowed)).toThrow(
      'Fill all 8 letters',
    );
    const room = phraseRoom();
    expect(() => guess(room, 'Z'.repeat(27))).toThrow(
      'Words 1, 2, 3, 4, and 5 are not in word list',
    );
    expect(room.players[0].attempts).toHaveLength(0);
    expect(
      createSchema.parse({ name: 'Ada', mode: 'duel', game: 'phrases' }).game,
    ).toBe('phrases');
    expect(createSchema.parse({ name: 'Ada', mode: 'duel' }).game).toBe(
      'words',
    );
    expect(
      createSchema.safeParse({ name: 'Ada', mode: 'duel', game: 'other' })
        .success,
    ).toBe(false);
  });
});
describe('shared room engine', () => {
  it('hides answer letters, scores a full phrase, and rematches with a new layout', () => {
    const room = phraseRoom();
    const view = projectRoom(room, p1, 4000);
    expect(view.game).toBe('phrases');
    expect(view.match.phraseTemplate).toBe('_______ _____ ______ ____ _____');
    expect(view.match).not.toHaveProperty('answer');
    guess(room, 'ACTIONS SPEAK LOUDER THAN WORDS');
    expect(solved(room.players[0])).toBe(true);
    advance(room, 4750);
    expect(room.match.phase).toBe('complete');
    expect(projectRoom(room, p1, 4750).match.answer).toBe(room.match.answer);
    room.players[1].rematch = true;
    applyAction(
      room,
      p1,
      { type: 'rematch' },
      5000,
      PHRASE_WORDS,
      () => "A LEOPARD CAN'T CHANGE ITS SPOTS",
      randomUUID,
    );
    expect(room.game).toBe('phrases');
    expect(room.players[0].attempts).toHaveLength(0);
    expect(projectRoom(room, p1, 5000).match.phraseTemplate).toContain("___'_");
  });
  it('keeps retries idempotent across punctuation and detects phrase timeouts', () => {
    const room = phraseRoom('ANOTHER DAY, ANOTHER DOLLAR');
    const action = {
      type: 'guess' as const,
      word: 'ANOTHERDAYANOTHERDOLLAR',
      requestId: randomUUID(),
      matchId: room.match.id,
    };
    applyAction(room, p1, action, 4000, PHRASE_WORDS, () => '', randomUUID);
    applyAction(
      room,
      p1,
      { ...action, word: 'Another day, another dollar' },
      4001,
      PHRASE_WORDS,
      () => '',
      randomUUID,
    );
    expect(room.players[0].attempts).toHaveLength(1);
    const timed = phraseRoom();
    advance(timed, timed.match.startsAt! + 180000);
    expect(timed.match.phase).toBe('complete');
  });
  it.each(['easy', 'medium', 'hard'] as const)(
    'uses the %s bot without passing the hidden phrase to its strategy',
    (difficulty) => {
      const template = phraseTemplate('BETTER LATE THAN NEVER');
      const attempts: Attempt[] = [];
      const word = choosePhraseBotGuess(
        template,
        attempts,
        () => 0,
        difficulty,
      );
      expect(validatePhraseGuess(word, template, PHRASE_WORDS)).toBe(word);
      const room = phraseRoom('BETTER LATE THAN NEVER');
      room.botDifficulty = difficulty;
      room.players[1].isBot = true;
      room.botNextGuessAt = 4000;
      advanceBots(room, 4000, {
        id: randomUUID,
        randomIndex: () => 0,
        thinkMs: () => 10000,
        nextAnswer: () => "A LEOPARD CAN'T CHANGE ITS SPOTS",
      });
      expect(room.players[1].attempts).toHaveLength(1);
      const view = projectRoom(room, p1, 4000);
      expect(view.players[1]).not.toHaveProperty('attempts');
      expect(view).not.toHaveProperty('botNextGuessAt');
    },
  );
});
