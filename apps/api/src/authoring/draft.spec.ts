import type { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { VoyageClient } from '../voyage/voyage-client';
import { parseArgs, runDrafts, type DraftRunOptions } from './draft';
import { regenerateArgs, rejectedDraftWarning } from './review';
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

  const skeleton = (lessons: Lesson[]): Skeleton => ({
    module: {
      id: 'm',
      title: 'M',
      language: 'ja',
      chapters: [{ id: 'c', title: 'C', lessons }],
    },
    generatedAt: new Date().toISOString(),
    model: 'compiled-outline',
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
    surfaces: { 'ja:kana:a': 'あ' },
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

  it('--force that is rejected leaves the previous draft alone', async () => {
    write('l1.json', { old: true });
    japanese = 'か';
    await run([lesson(1)], { force: true });
    expect(read('l1.json')).toEqual({ old: true });
    expect(fs.existsSync(inDir('l1.prev.json'))).toBe(false);
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

  it('defaults to no force and no limit', () => {
    expect(parseArgs(['l1'])).toMatchObject({
      force: false,
      maxCostUsd: undefined,
    });
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
