import type { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { VoyageClient } from '../voyage/voyage-client';
import { parseArgs, runDrafts, type DraftRunOptions } from './draft';
import { regenerateArgs, rejectedDraftWarning } from './review';
import type { LessonDraft } from './lesson-schema';
import type { Lesson, Skeleton } from './skeleton-schema';

const lesson = (n: number): Lesson => ({
  id: `l${n}`,
  type: 'F-Kana',
  title: `Lesson ${n}`,
  itemIds: ['ja:kana:a'],
  estimatedMinutes: 7,
});

function replyFor(id: string, japanese: string) {
  return {
    lessonId: id,
    lessonType: 'F-Kana',
    title: 'Lesson',
    targetItemIds: ['ja:kana:a'],
    teach: { blocks: [{ type: 'text', text: japanese }] },
    practice: {
      templates: [{ targetItemId: 'ja:kana:a', mode: 'recognition' }],
    },
    check: {
      questions: [
        {
          id: 'q1',
          targetItemId: 'ja:kana:a',
          prompt: 'Which?',
          answerType: 'multiple-choice',
          choices: ['a', 'b', 'c', 'd'],
          correctAnswer: 'a',
          explanation: 'It is a.',
        },
      ],
    },
    meta: {
      generatedAt: new Date().toISOString(),
      model: 'm',
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    },
  };
}

describe('runDrafts (F.2.a)', () => {
  const saved = { ...process.env };
  let dir: string;
  let create: jest.Mock;
  let japanese: string;
  let spies: jest.SpyInstance[];

  const skeleton = (
    lessons: Lesson[],
    surfaces: Record<string, string> = { 'ja:kana:a': 'あ' },
  ): Skeleton => ({
    module: {
      id: 'm',
      title: 'M',
      language: 'ja',
      chapters: [{ id: 'c', title: 'C', lessons }],
    },
    generatedAt: new Date().toISOString(),
    model: 'compiled-outline',
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
    surfaces,
    soundStages: [],
  });

  const run = (lessons: Lesson[], over: Partial<DraftRunOptions> = {}) =>
    runDrafts({
      lessons,
      skeleton: skeleton(lessons),
      outputDir: dir,
      correctionsPath: path.join(dir, 'no-corrections.jsonl'),
      force: false,
      anthropic: { messages: { create } },
      prisma: {
        item: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 'ja:kana:a', display: 'あ', type: 'KANA', data: {} },
            ]),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
      } as unknown as PrismaClient,
      voyage: { enabled: false } as unknown as VoyageClient,
      ...over,
    });

  const inDir = (name: string) => path.join(dir, name);
  const write = (name: string, value: unknown) =>
    fs.writeFileSync(inDir(name), JSON.stringify(value));
  const read = (name: string) =>
    JSON.parse(fs.readFileSync(inDir(name), 'utf8')) as Record<string, unknown>;

  beforeEach(() => {
    delete process.env['LLM_AUTHORING_MODEL'];
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-'));
    japanese = 'あ';
    create = jest.fn((req: { messages: Array<{ content: string }> }) => {
      const [, id] = /LESSON: (\S+)/.exec(req.messages[0].content) ?? [];
      return Promise.resolve({
        content: [
          { type: 'text', text: JSON.stringify(replyFor(id, japanese)) },
        ],
        // 100k in + 20k out on Opus 4.8 = $0.50 + $0.50.
        usage: { input_tokens: 100_000, output_tokens: 20_000 },
      });
    });
    spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
    ];
  });

  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
    process.env = { ...saved };
  });

  it('drafts a new lesson and writes its file', async () => {
    const summary = await run([lesson(1)]);
    expect(summary).toMatchObject({ drafted: 1, skipped: 0, rejected: 0 });
    expect(summary.costUsd).toBeCloseTo(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(read('l1.json').lessonId).toBe('l1');
  });

  it('skips a lesson with a draft and makes no model call', async () => {
    write('l1.json', { kept: true });
    const summary = await run([lesson(1)]);
    expect(summary).toMatchObject({ drafted: 0, skipped: 1 });
    expect(create).not.toHaveBeenCalled();
    expect(read('l1.json')).toEqual({ kept: true });
  });

  it('skips a rejected lesson, so a chapter re-run does not re-bill it', async () => {
    write('l1.rejected.json', { rejected: true });
    expect(await run([lesson(1)])).toMatchObject({ skipped: 1 });
    expect(create).not.toHaveBeenCalled();
  });

  it('--force redrafts, keeps the old draft and clears stale files', async () => {
    write('l1.json', { old: true });
    write('l1.critique.json', { stale: true });
    write('l1.rejected.json', { stale: true });
    const summary = await run([lesson(1)], { force: true });
    expect(summary).toMatchObject({ drafted: 1, skipped: 0 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(read('l1.prev.json')).toEqual({ old: true });
    expect(read('l1.json').lessonId).toBe('l1');
    expect(fs.existsSync(inDir('l1.critique.json'))).toBe(false);
    expect(fs.existsSync(inDir('l1.rejected.json'))).toBe(false);
  });

  it('--force keeps the old draft in place when the call fails', async () => {
    write('l1.json', { old: true });
    create.mockRejectedValue(new Error('credit balance too low'));
    await expect(run([lesson(1)], { force: true })).rejects.toThrow(/credit/);
    expect(read('l1.json')).toEqual({ old: true });
    expect(fs.existsSync(inDir('l1.prev.json'))).toBe(false);
  });

  it('a draft that breaks the rules is rejected, never a draft, and the batch goes on', async () => {
    japanese = 'か'; // Only あ is taught by these lessons.
    const summary = await run([lesson(1), lesson(2)]);
    expect(summary).toMatchObject({ drafted: 0, rejected: 2 });
    expect(fs.existsSync(inDir('l1.json'))).toBe(false);
    expect(read('l1.rejected.json').courseRuleErrors).toEqual([
      'teach[0]: uses か before it is taught',
    ]);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('--force tells the redraft why the last draft was rejected (F.2.c)', async () => {
    write('l1.rejected.json', {
      ...replyFor('l1', 'か'),
      courseRuleErrors: ['teach[0]: uses か before it is taught'],
    });
    await run([lesson(1)], { force: true });
    const [request] = create.mock.calls[0] as [
      { messages: Array<{ content: string }> },
    ];
    expect(request.messages[0].content).toContain(
      'Your last draft of this lesson was rejected for:\n' +
        '  - teach[0]: uses か before it is taught\n' +
        'Fix every one.',
    );
  });

  it('a first draft carries no rejection block', async () => {
    await run([lesson(1)]);
    const [request] = create.mock.calls[0] as [
      { messages: Array<{ content: string }> },
    ];
    expect(request.messages[0].content).not.toContain('was rejected');
  });

  it('--force that is rejected leaves the previous draft alone', async () => {
    write('l1.json', { old: true });
    japanese = 'か';
    await run([lesson(1)], { force: true });
    expect(read('l1.json')).toEqual({ old: true });
    expect(fs.existsSync(inDir('l1.prev.json'))).toBe(false);
  });

  describe('a typed-reading lesson (F.2.b)', () => {
    const kana: Lesson = { ...lesson(1), itemIds: ['ja:kana:a', 'ja:kana:i'] };
    const reading: Lesson = {
      id: 'l2',
      type: 'F-Vocab',
      title: 'Reading',
      itemIds: ['ja:vocab:愛'],
      estimatedMinutes: 7,
      typedReading: true,
    };
    const readingSkeleton = skeleton([kana, reading], {
      'ja:kana:a': 'あ',
      'ja:kana:i': 'い',
      'ja:vocab:愛': 'あい',
    });
    const vocab = { id: 'ja:vocab:愛', display: '愛', type: 'VOCAB', data: {} };
    const readingRun = (over: Partial<DraftRunOptions> = {}) =>
      run([reading], {
        skeleton: readingSkeleton,
        prisma: {
          item: { findMany: jest.fn().mockResolvedValue([vocab]) },
          $queryRaw: jest.fn().mockResolvedValue([]),
        } as unknown as PrismaClient,
        ...over,
      });
    /** Lesson 19 twice over: the right answer, but recall from English. */
    const recall = {
      ...replyFor('l2', 'あい'),
      lessonType: 'F-Vocab',
      targetItemIds: ['ja:vocab:愛'],
      practice: {
        templates: [{ targetItemId: 'ja:vocab:愛', mode: 'recognition' }],
      },
      check: {
        questions: [
          {
            id: 'q1',
            targetItemId: 'ja:vocab:愛',
            prompt: "Type the kana word that means 'love'.",
            answerType: 'typed',
            correctAnswer: 'あい',
            explanation: 'Nice!',
          },
        ],
      },
    };

    it('saves a recall-style reply as a draft, with a reading prompt', async () => {
      create.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(recall) }],
        usage: { input_tokens: 100_000, output_tokens: 20_000 },
      });
      const summary = await readingRun();
      expect(summary).toMatchObject({ drafted: 1, rejected: 0 });
      expect(fs.existsSync(inDir('l2.rejected.json'))).toBe(false);
      const [q1] = (read('l2.json') as unknown as LessonDraft).check.questions;
      expect(q1).toMatchObject({
        id: 'q1',
        prompt: 'Read this word and type how it sounds: あい',
        explanation: 'Nice!',
      });
    });

    it('--recheck saves a rejected draft like lesson 19 at $0, with no model call', async () => {
      write('l2.rejected.json', {
        ...recall,
        courseRuleErrors: ['ja:vocab:愛 needs a typed check showing あい'],
      });
      write('l2.json', { old: true });
      write('l2.critique.json', { stale: true });
      const summary = await readingRun({ recheck: true });
      expect(summary).toMatchObject({
        drafted: 0,
        rechecked: 1,
        rejected: 0,
        costUsd: 0,
      });
      expect(create).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled(); // validator and gate pass
      const saved = read('l2.json') as unknown as LessonDraft;
      expect(saved).not.toHaveProperty('courseRuleErrors');
      expect(saved.check.questions[0].prompt).toBe(
        'Read this word and type how it sounds: あい',
      );
      expect(saved.meta).toEqual(recall.meta);
      // Written exactly as a fresh pass is.
      expect(read('l2.prev.json')).toEqual({ old: true });
      expect(fs.existsSync(inDir('l2.rejected.json'))).toBe(false);
      expect(fs.existsSync(inDir('l2.critique.json'))).toBe(false);
    });
  });

  describe('--recheck (F.2.b)', () => {
    it('keeps a draft that still fails rejected, with its errors brought up to date', async () => {
      write('l1.rejected.json', {
        ...replyFor('l1', 'か'),
        courseRuleErrors: ['an old error'],
      });
      const summary = await run([lesson(1)], { recheck: true });
      expect(summary).toMatchObject({ rechecked: 0, rejected: 1, costUsd: 0 });
      expect(create).not.toHaveBeenCalled();
      expect(fs.existsSync(inDir('l1.json'))).toBe(false);
      expect(read('l1.rejected.json').courseRuleErrors).toEqual([
        'teach[0]: uses か before it is taught',
      ]);
    });

    it('skips a lesson whose skeleton gives no course context, so no gate', async () => {
      write('l1.rejected.json', {
        ...replyFor('l1', 'か'),
        courseRuleErrors: ['teach[0]: uses か before it is taught'],
      });
      const bare = { ...skeleton([lesson(1)]), surfaces: undefined };
      const summary = await run([lesson(1)], {
        skeleton: bare,
        recheck: true,
      });
      expect(summary).toMatchObject({ rechecked: 0, rejected: 0, skipped: 1 });
      expect(fs.existsSync(inDir('l1.json'))).toBe(false);
      expect(read('l1.rejected.json').courseRuleErrors).toEqual([
        'teach[0]: uses か before it is taught',
      ]);
    });

    it('skips a lesson with no rejected draft, even one with a draft', async () => {
      write('l1.json', { kept: true });
      const summary = await run([lesson(1), lesson(2)], { recheck: true });
      expect(summary).toMatchObject({ rechecked: 0, skipped: 2, drafted: 0 });
      expect(create).not.toHaveBeenCalled();
      expect(read('l1.json')).toEqual({ kept: true });
      expect(fs.existsSync(inDir('l2.json'))).toBe(false);
    });
  });

  describe('a check on an item the draft does not declare (F.2.h)', () => {
    const garbled = (correctAnswer: string) => {
      const reply = replyFor('l1', 'あ');
      const [q1] = reply.check.questions;
      return {
        ...reply,
        check: {
          questions: [{ ...q1, targetItemId: 'ja:kana:aa', correctAnswer }],
        },
      };
    };
    const replying = (reply: unknown) =>
      create.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(reply) }],
        usage: { input_tokens: 100_000, output_tokens: 20_000 },
      });

    it('is repointed when its answer is exactly one declared target', async () => {
      replying(garbled('a'));
      expect(await run([lesson(1)])).toMatchObject({ drafted: 1 });
      const saved = read('l1.json') as unknown as LessonDraft;
      expect(saved.check.questions[0].targetItemId).toBe('ja:kana:a');
    });

    it('is rejected, never saved as a draft, when its answer names none', async () => {
      replying(garbled('b'));
      expect(await run([lesson(1)])).toMatchObject({ rejected: 1, drafted: 0 });
      expect(fs.existsSync(inDir('l1.json'))).toBe(false);
      expect(read('l1.rejected.json').courseRuleErrors).toEqual([
        'structure: check question "q1" references undeclared targetItemId "ja:kana:aa"',
      ]);
    });
  });

  describe('a paid reply that is not a draft (F.2.f)', () => {
    /** Wave 2's crash: an answer type the schema doesn't know. */
    const broken = (id: string) => {
      const reply = replyFor(id, 'あ');
      return {
        ...reply,
        meta: { ...reply.meta, generatedAt: '2026-11-15T10:00:00.000Z' },
        check: {
          questions: [{ ...reply.check.questions[0], answerType: 'drawn' }],
        },
      };
    };
    const replyWith = (text: string, stop_reason = 'end_turn') =>
      Promise.resolve({
        content: [{ type: 'text', text }],
        stop_reason,
        usage: { input_tokens: 100_000, output_tokens: 20_000 },
      });

    it('is saved with its tokens and cost, and the batch goes on', async () => {
      create.mockImplementationOnce(() =>
        replyWith(JSON.stringify(broken('l1'))),
      );
      const summary = await run([lesson(1), lesson(2)]);
      expect(summary).toMatchObject({ drafted: 1, failed: 1, rejected: 0 });
      expect(summary.costUsd).toBeCloseTo(2);
      expect(fs.existsSync(inDir('l1.json'))).toBe(false);
      const failed = read('l1.failed.json');
      expect(failed).toMatchObject({
        lessonId: 'l1',
        model: 'claude-opus-4-8',
        inputTokens: 100_000,
        outputTokens: 20_000,
        costUsd: 1,
        stopReason: 'end_turn',
        reply: broken('l1'),
      });
      expect(failed.error).toMatch(/check\.questions\.0\.answerType/);
      expect(failed).not.toHaveProperty('raw');
      expect(read('l2.json').lessonId).toBe('l2');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[reply\] FAILED — .*\(tokens: 100000 in \/ 20000 out {2}\(~\$1\.0000\)\) → .*l1\.failed\.json$/,
        ),
      );
    });

    it('keeps a reply cut off at max_tokens as text, and counts it', async () => {
      create.mockImplementationOnce(() =>
        replyWith('{"lessonId": "l1", "teach":', 'max_tokens'),
      );
      const summary = await run([lesson(1)]);
      expect(summary).toMatchObject({ failed: 1, drafted: 0 });
      expect(summary.costUsd).toBeCloseTo(1);
      const failed = read('l1.failed.json');
      expect(failed).toMatchObject({
        raw: '{"lessonId": "l1", "teach":',
        stopReason: 'max_tokens',
      });
      expect(failed.error).toMatch(/cut off/);
      expect(failed).not.toHaveProperty('reply');
    });

    it('counts against --max-cost, so the run stops before the next lesson', async () => {
      create.mockImplementationOnce(() =>
        replyWith(JSON.stringify(broken('l1'))),
      );
      const summary = await run([lesson(1), lesson(2)], { maxCostUsd: 1 });
      expect(summary).toMatchObject({ failed: 1, stoppedBefore: 'l2' });
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('is skipped on the next run, because it was paid for', async () => {
      write('l1.failed.json', { lessonId: 'l1' });
      expect(await run([lesson(1)])).toMatchObject({ skipped: 1 });
      expect(create).not.toHaveBeenCalled();
    });

    it('--force keeps the older failed reply as .failed.prev.json', async () => {
      write('l1.failed.json', { older: true });
      create.mockImplementationOnce(() =>
        replyWith(JSON.stringify(broken('l1'))),
      );
      await run([lesson(1)], { force: true });
      expect(read('l1.failed.prev.json')).toEqual({ older: true });
      expect(read('l1.failed.json').reply).toEqual(broken('l1'));
    });

    it('never overwrites an older failed reply, however many there are', async () => {
      write('l1.failed.json', { a: true });
      write('l1.failed.prev.json', { older: true });
      create.mockImplementationOnce(() =>
        replyWith(JSON.stringify(broken('l1'))),
      );
      await run([lesson(1)], { force: true });
      expect(read('l1.failed.prev.json')).toEqual({ older: true });
      expect(read('l1.failed.prev.2.json')).toEqual({ a: true });
      expect(read('l1.failed.json').reply).toEqual(broken('l1'));
    });

    it('--force tells the redraft why the failed reply could not be read (F.2.c)', async () => {
      write('l1.failed.json', {
        lessonId: 'l1',
        error: 'check.questions.0.answerType: Invalid enum value',
      });
      write('l1.rejected.json', {
        ...replyFor('l1', 'か'),
        courseRuleErrors: ['an older rejection'],
      });
      await run([lesson(1)], { force: true });
      const [request] = create.mock.calls[0] as [
        { messages: Array<{ content: string }> },
      ];
      expect(request.messages[0].content).toContain(
        '  - the reply could not be read as a draft: check.questions.0.answerType: Invalid enum value\n',
      );
      expect(request.messages[0].content).not.toContain('an older rejection');
    });

    it('--force that drafts puts the older failed reply aside, so --recheck cannot restore it', async () => {
      write('l1.failed.json', { older: true });
      await run([lesson(1)], { force: true });
      expect(read('l1.json').lessonId).toBe('l1');
      expect(fs.existsSync(inDir('l1.failed.json'))).toBe(false);
      expect(read('l1.failed.prev.json')).toEqual({ older: true });
    });

    it('is kept when saving fails for another reason, and the run stops', async () => {
      // The old draft can't be moved aside: a directory is in the way.
      write('l1.json', { old: true });
      fs.mkdirSync(inDir('l1.prev.json/full'), { recursive: true });
      await expect(
        run([lesson(1), lesson(2)], { force: true }),
      ).rejects.toThrow();
      expect(create).toHaveBeenCalledTimes(1);
      const failed = read('l1.failed.json');
      expect(failed).toMatchObject({ inputTokens: 100_000, costUsd: 1 });
      expect(failed.error).toBeTruthy();
      expect((failed.reply as LessonDraft).lessonId).toBe('l1');
      expect(read('l1.json')).toEqual({ old: true });
    });

    describe('--recheck', () => {
      /** Saved by wave 2's code: closed, but with a grading the schema refused. */
      const wave2 = (id: string) => {
        const reply = replyFor(id, 'あ');
        return {
          lessonId: id,
          receivedAt: '2026-11-15T10:00:00.000Z',
          model: 'claude-opus-4-8',
          inputTokens: 100_000,
          outputTokens: 20_000,
          costUsd: 1,
          stopReason: 'end_turn',
          error: 'check.questions.0.grading: Invalid literal value',
          reply: {
            ...reply,
            check: {
              questions: [{ ...reply.check.questions[0], grading: 'closed' }],
            },
          },
        };
      };

      it('recovers a failed reply once the cause is fixed, with no model call', async () => {
        write('l1.failed.json', wave2('l1'));
        const summary = await run([lesson(1)], {
          recheck: true,
          anthropic: {
            messages: {
              create: () => Promise.reject(new Error('no model call')),
            },
          },
        });
        expect(summary).toMatchObject({ rechecked: 1, failed: 0, costUsd: 0 });
        const saved = read('l1.json') as unknown as LessonDraft;
        expect(saved.check.questions[0]).not.toHaveProperty('grading');
        expect(saved.meta).toEqual({
          generatedAt: '2026-11-15T10:00:00.000Z',
          model: 'claude-opus-4-8',
          tokenUsage: { inputTokens: 100_000, outputTokens: 20_000 },
        });
        expect(fs.existsSync(inDir('l1.failed.json'))).toBe(false);
      });

      it('reads it before a rejected draft, and rejects it like a fresh one', async () => {
        const failed = wave2('l1');
        failed.reply.teach.blocks = [{ type: 'text', text: 'か' }];
        write('l1.failed.json', failed);
        write('l1.rejected.json', { ...replyFor('l1', 'あ'), older: true });
        const summary = await run([lesson(1)], { recheck: true });
        expect(summary).toMatchObject({ rejected: 1, rechecked: 0 });
        expect(read('l1.rejected.json')).not.toHaveProperty('older');
        expect(read('l1.rejected.json').courseRuleErrors).toEqual([
          'teach[0]: uses か before it is taught',
        ]);
        expect(fs.existsSync(inDir('l1.failed.json'))).toBe(false);
      });

      it('reads a reply saved as text, once it is fixed by hand', async () => {
        const { reply, ...rest } = wave2('l1');
        write('l1.failed.json', {
          ...rest,
          raw: `Here it is:\n${JSON.stringify(reply)}`,
        });
        expect(await run([lesson(1)], { recheck: true })).toMatchObject({
          rechecked: 1,
        });
      });

      it('still refuses text cut off at max_tokens, though a whole object sits in it', async () => {
        const { reply, ...rest } = wave2('l1');
        write('l1.failed.json', {
          ...rest,
          stopReason: 'max_tokens',
          raw: `${JSON.stringify(reply)}\nCorrection: {"lessonId": "l1", "teach":`,
        });
        const summary = await run([lesson(1)], { recheck: true });
        expect(summary).toMatchObject({ failed: 1, rechecked: 0 });
        expect(read('l1.failed.json').error).toMatch(/cut off/);
        expect(fs.existsSync(inDir('l1.json'))).toBe(false);
      });

      it('keeps a reply that still fails, with its error brought up to date', async () => {
        write('l1.failed.json', { ...wave2('l1'), reply: broken('l1') });
        const summary = await run([lesson(1)], { recheck: true });
        expect(summary).toMatchObject({ failed: 1, rechecked: 0, costUsd: 0 });
        expect(create).not.toHaveBeenCalled();
        const failed = read('l1.failed.json');
        expect(failed.error).toMatch(/answerType/);
        expect(failed.reply).toEqual(broken('l1'));
        expect(fs.existsSync(inDir('l1.json'))).toBe(false);
      });
    });
  });

  it('--max-cost stops before the next paid lesson and says where', async () => {
    const summary = await run([lesson(1), lesson(2), lesson(3)], {
      maxCostUsd: 1.5,
    });
    expect(summary).toMatchObject({ drafted: 2, stoppedBefore: 'l3' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('--max-cost still walks past skipped lessons', async () => {
    write('l1.json', {});
    const summary = await run([lesson(1), lesson(2)], { maxCostUsd: 0.5 });
    expect(summary).toMatchObject({ drafted: 1, skipped: 1 });
    expect(summary.stoppedBefore).toBeUndefined();
  });

  it('--max-cost refuses a model with no known price', async () => {
    process.env['LLM_AUTHORING_MODEL'] = 'some-other-model';
    await expect(run([lesson(1)], { maxCostUsd: 1 })).rejects.toThrow(
      /no known price/,
    );
    expect(create).not.toHaveBeenCalled();
  });
});

describe('parseArgs', () => {
  it('finds the slug wherever the flags sit, and reads --force and --max-cost', () => {
    expect(
      parseArgs(['--max-cost', '2.5', '--force', 'foundation-ja-ch04']),
    ).toMatchObject({
      slug: 'foundation-ja-ch04',
      force: true,
      maxCostUsd: 2.5,
    });
  });

  it('defaults to no force, no recheck and no limit', () => {
    expect(parseArgs(['l1'])).toMatchObject({
      force: false,
      recheck: false,
      maxCostUsd: undefined,
    });
  });

  it('reads --recheck', () => {
    expect(parseArgs(['--recheck', 'l1'])).toMatchObject({
      slug: 'l1',
      recheck: true,
      force: false,
    });
  });

  it('refuses --recheck together with --force', () => {
    expect(() => parseArgs(['l1', '--recheck', '--force'])).toThrow(
      /--recheck/,
    );
  });

  it.each(['abc', '0', '-1'])('refuses --max-cost %s', (value) => {
    expect(() => parseArgs(['l1', '--max-cost', value])).toThrow(/--max-cost/);
  });
});

describe('review of a lesson whose last redraft failed the gate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-'));

  it('stays quiet when there is no rejected draft', () => {
    expect(rejectedDraftWarning(dir, 'l1')).toBeNull();
  });

  it('warns when <id>.rejected.json sits beside the draft', () => {
    fs.writeFileSync(path.join(dir, 'l2.rejected.json'), '{}');
    expect(rejectedDraftWarning(dir, 'l2')).toMatch(/older draft/);
    expect(rejectedDraftWarning(dir, 'l1')).toBeNull();
  });
});

describe('review --regenerate', () => {
  it('passes --force, or authoring:draft would skip the existing draft', () => {
    expect(regenerateArgs('l1', '/s.json')).toContain('--force');
  });
});
