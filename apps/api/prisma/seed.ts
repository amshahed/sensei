import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The first real lesson: the five hiragana vowels (F-Kana). Every later kana
// builds on these, so it's the natural entry point for the beta slice (M.1).
const VOWELS = [
  { id: 'ja:kana:a', display: 'あ', romaji: 'a', hint: "like 'a' in 'father'" },
  { id: 'ja:kana:i', display: 'い', romaji: 'i', hint: "like 'ee' in 'see'" },
  { id: 'ja:kana:u', display: 'う', romaji: 'u', hint: "like 'oo' in 'food'" },
  { id: 'ja:kana:e', display: 'え', romaji: 'e', hint: "like 'e' in 'bed'" },
  { id: 'ja:kana:o', display: 'お', romaji: 'o', hint: "like 'o' in 'or'" },
];

async function main() {
  // Items — idempotent upserts.
  for (const v of VOWELS) {
    const data = { romaji: v.romaji, kanaType: 'hiragana', hint: v.hint };
    await prisma.item.upsert({
      where: { id: v.id },
      update: { display: v.display, reading: v.display, data },
      create: {
        id: v.id,
        language: 'ja',
        type: 'KANA',
        display: v.display,
        reading: v.display,
        data,
      },
    });
  }

  const module = await prisma.module.upsert({
    where: { slug: 'foundation-ja' },
    update: { title: 'Foundation (Japanese)' },
    create: {
      slug: 'foundation-ja',
      language: 'ja',
      title: 'Foundation (Japanese)',
      position: 1,
    },
  });

  const chapter = await prisma.chapter.upsert({
    where: { slug: 'hiragana-vowels' },
    update: { title: 'Hiragana — Vowels' },
    create: {
      slug: 'hiragana-vowels',
      moduleId: module.id,
      title: 'Hiragana — Vowels',
      position: 1,
    },
  });

  const teach = {
    blocks: [
      { kind: 'heading', text: 'The Five Vowels' },
      {
        kind: 'text',
        text: 'Japanese has exactly five vowel sounds. Every hiragana you learn later is built from these — so learn their shapes and sounds first.',
      },
      ...VOWELS.map((v) => ({
        kind: 'kana',
        itemId: v.id,
        char: v.display,
        romaji: v.romaji,
        hint: v.hint,
      })),
    ],
  };

  const lesson = await prisma.lesson.upsert({
    where: { slug: 'the-five-vowels' },
    update: { title: 'The Five Vowels あいうえお', teach },
    create: {
      slug: 'the-five-vowels',
      chapterId: chapter.id,
      title: 'The Five Vowels あいうえお',
      type: 'F_KANA',
      position: 1,
      estimatedMinutes: 5,
      teach,
    },
  });

  // Lesson ↔ item links — idempotent.
  for (let i = 0; i < VOWELS.length; i++) {
    await prisma.lessonItem.upsert({
      where: { lessonId_itemId: { lessonId: lesson.id, itemId: VOWELS[i].id } },
      update: { position: i },
      create: {
        lessonId: lesson.id,
        itemId: VOWELS[i].id,
        role: 'TARGET',
        position: i,
      },
    });
  }

  // Checks — rebuilt deterministically so re-seeding stays idempotent.
  await prisma.check.deleteMany({ where: { lessonId: lesson.id } });
  const choices = VOWELS.map((v) => v.display);
  for (let i = 0; i < VOWELS.length; i++) {
    const v = VOWELS[i];
    await prisma.check.create({
      data: {
        lessonId: lesson.id,
        position: i,
        prompt: `Which kana is read “${v.romaji}”?`,
        format: 'MULTIPLE_CHOICE',
        targetItemId: v.id,
        data: { choices, answer: v.display },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded "${lesson.title}" (slug: ${lesson.slug}) — ${VOWELS.length} items, ${VOWELS.length} checks.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
