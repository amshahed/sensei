import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  ChapterState,
  CurriculumChapterDto,
  CurriculumDto,
  CurriculumLessonDto,
  LessonState,
  NextStepDto,
} from '@sensei/types';
import { api } from '../api';
import { PrimaryButton, Screen, ui } from '../ui';

const CHAPTER_STATE = {
  completed: { label: 'Completed', glyph: '✓', color: '#0E8A16' },
  current: { label: 'Current', glyph: '▶', color: '#1D4ED8' },
  skipped_via_placement: { label: 'Skipped', glyph: '↷', color: '#9A6700' },
  available: { label: 'Available', glyph: '○', color: '#555' },
  locked: { label: 'Locked', glyph: '–', color: '#aaa' },
} satisfies Record<
  ChapterState,
  { label: string; glyph: string; color: string }
>;

const LESSON_STATE = {
  completed: { label: 'Done', color: '#0E8A16' },
  current: { label: 'Up next', color: '#1D4ED8' },
  not_started: { label: 'Not started', color: '#999' },
  skipped: { label: 'Skipped', color: '#9A6700' },
} satisfies Record<LessonState, { label: string; color: string }>;

/**
 * Curriculum Outline (I.4.e): the Module → Chapter → Lesson tree with state
 * indicators. Read-only by design — lessons can be inspected but not opened
 * out of order (no mid-chapter jumping); the only way into a lesson is
 * "Continue", which opens the learner's next step. Chapter actions: the
 * Assessment (skip-test ahead, or the exit Assessment once the lessons are
 * done, I.4.d.a) and relocate position (skipped chapters → learn them
 * properly), undone from the "revisiting" banner. Once a chapter has been
 * learned (or tested out of), "Practise this chapter" drills it (J.1.b) —
 * practice never moves the learner's position.
 */
export function CurriculumScreen({
  onContinue,
  onAssessment,
  onPractice,
}: {
  onContinue: (step: NextStepDto) => void;
  onAssessment: (chapterId: string) => void;
  onPractice: (chapterId: string, title: string) => void;
}) {
  const [data, setData] = useState<CurriculumDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [relocating, setRelocating] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const apply = useCallback((d: CurriculumDto) => {
    setData(d);
    // Keep the learner's own chapter open so the outline lands on "you are here".
    if (d.currentChapterId) {
      const id = d.currentChapterId;
      setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    }
  }, []);

  const load = useCallback(() => {
    let active = true;
    setError(null);
    api
      .curriculum()
      .then((d) => active && apply(d))
      .catch((e: unknown) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, [apply]);

  useEffect(load, [load]);

  const toggle = (chapterId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });

  /** A skipped chapter to go back to, or null to return to the furthest point. */
  const relocate = (chapterId: string | null) => {
    setRelocating(chapterId ?? 'return');
    setActionError(null);
    api
      .relocate(chapterId)
      .then(apply)
      .catch((e: unknown) => setActionError(String(e)))
      .finally(() => setRelocating(null));
  };

  if (error) {
    return (
      <View style={ui.center}>
        <Text style={ui.err}>Couldn't load the curriculum</Text>
        <Text style={ui.hint}>{error}</Text>
        <PrimaryButton label="Retry" onPress={load} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
        <Text style={ui.hint}>Loading curriculum…</Text>
      </View>
    );
  }

  const next = data.next;
  return (
    <Screen
      footer={
        next ? (
          <PrimaryButton
            label={`Continue: ${
              next.kind === 'assessment' ? 'Chapter assessment' : next.title
            }`}
            onPress={() => onContinue(next)}
          />
        ) : null
      }
    >
      <Text style={ui.title}>Curriculum</Text>
      {data.modules.length === 0 ? (
        <Text style={ui.hint}>No lessons published yet.</Text>
      ) : null}
      {!next && data.modules.length > 0 ? (
        <Text style={ui.ok}>You've finished everything published so far.</Text>
      ) : null}
      {actionError ? <Text style={ui.err}>{actionError}</Text> : null}
      {data.relocated ? (
        <View style={styles.banner}>
          <Text style={ui.body}>
            You’re revisiting{' '}
            <Text style={styles.bold}>{currentTitle(data)}</Text>. Your furthest
            point is kept.
          </Text>
          <Pressable
            style={[styles.action, relocating !== null && styles.dim]}
            onPress={() => relocate(null)}
            disabled={relocating !== null}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>
              {relocating === 'return'
                ? 'Moving…'
                : 'Return to your furthest point'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {data.modules.map((m) => (
        <View key={m.id} style={styles.module}>
          <Text style={ui.kicker}>{m.title}</Text>
          {m.chapters.map((c) => (
            <ChapterRow
              key={c.id}
              chapter={c}
              open={expanded.has(c.id)}
              onToggle={() => toggle(c.id)}
              relocating={relocating === c.id}
              relocateDisabled={relocating !== null}
              onRelocate={() => relocate(c.id)}
              assessmentLabel={
                // Mirrors the server: lessons all done → EXIT (misses count
                // in reviews); otherwise a no-penalty skip-test.
                c.lessons.every(
                  (l) => l.state === 'completed' || l.state === 'skipped',
                )
                  ? 'Take the chapter assessment'
                  : 'Already know this? Take the skip test'
              }
              onAssessment={() => onAssessment(c.id)}
              onPractice={() => onPractice(c.id, c.title)}
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function currentTitle(d: CurriculumDto): string {
  for (const m of d.modules) {
    const c = m.chapters.find((x) => x.id === d.currentChapterId);
    if (c) return c.title;
  }
  return 'an earlier chapter';
}

function ChapterRow({
  chapter: c,
  open,
  onToggle,
  relocating,
  relocateDisabled,
  onRelocate,
  assessmentLabel,
  onAssessment,
  onPractice,
}: {
  chapter: CurriculumChapterDto;
  open: boolean;
  onToggle: () => void;
  relocating: boolean;
  relocateDisabled: boolean;
  onRelocate: () => void;
  assessmentLabel: string;
  onAssessment: () => void;
  onPractice: () => void;
}) {
  const st = CHAPTER_STATE[c.state];
  const locked = c.state === 'locked';
  // Something here has been learned: practice drills only learned items (J.1.e).
  const practisable =
    c.state === 'completed' ||
    c.lessons.some((l) => l.state === 'completed' || l.state === 'skipped');
  return (
    <View style={[styles.chapter, c.state === 'current' && styles.current]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${c.title}, ${st.label}`}
        style={styles.chapterHead}
      >
        <Text style={[styles.glyph, { color: st.color }]}>{st.glyph}</Text>
        <View style={styles.grow}>
          <Text style={[styles.chapterTitle, locked && styles.dim]}>
            {c.title}
          </Text>
          <Text style={ui.hint}>
            {c.lessonCount} lesson{c.lessonCount === 1 ? '' : 's'}
            {c.estimatedMinutes > 0 ? ` · ~${c.estimatedMinutes} min` : ''}
            {' · '}
            <Text style={{ color: st.color }}>{st.label}</Text>
          </Text>
        </View>
        <Text style={ui.hint}>{open ? '▾' : '▸'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.lessons}>
          {c.lessons.map((l) => (
            <LessonRow key={l.id} lesson={l} />
          ))}
          {c.actions.assessment ? (
            <Pressable
              style={styles.action}
              onPress={onAssessment}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>{assessmentLabel}</Text>
            </Pressable>
          ) : null}
          {practisable ? (
            <Pressable
              style={styles.action}
              onPress={onPractice}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>Practise this chapter</Text>
            </Pressable>
          ) : null}
          {c.actions.relocate ? (
            <Pressable
              style={[styles.action, relocateDisabled && styles.dim]}
              onPress={onRelocate}
              disabled={relocateDisabled}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>
                {relocating ? 'Moving…' : 'Go back and learn this chapter'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Read-only: tapping shows the lesson's key items, never opens the lesson. */
function LessonRow({ lesson: l }: { lesson: CurriculumLessonDto }) {
  const [open, setOpen] = useState(false);
  const st = LESSON_STATE[l.state];
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={styles.lesson}
    >
      <View style={styles.lessonHead}>
        <Text style={[styles.grow, styles.lessonTitle]}>{l.title}</Text>
        <Text style={[styles.lessonState, { color: st.color }]}>
          {st.label}
        </Text>
      </View>
      <Text style={ui.hint}>
        {l.keyItems.length} key item{l.keyItems.length === 1 ? '' : 's'}
        {l.estimatedMinutes ? ` · ~${l.estimatedMinutes} min` : ''}
      </Text>
      {open ? (
        <View style={styles.items}>
          {l.keyItems.map((it) => (
            <View key={it.id} style={styles.item}>
              <Text style={styles.itemDisplay}>{it.display}</Text>
              {it.reading && it.reading !== it.display ? (
                <Text style={ui.hint}>{it.reading}</Text>
              ) : null}
              {it.meaning ? <Text style={ui.hint}>{it.meaning}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  module: { gap: 8, marginTop: 8 },
  banner: {
    borderWidth: 1,
    borderColor: '#9A6700',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    backgroundColor: '#FFF8E5',
  },
  bold: { fontWeight: '700' },
  chapter: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },
  current: { borderColor: '#1D4ED8' },
  chapterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  glyph: { fontSize: 18, width: 20, textAlign: 'center' },
  grow: { flex: 1 },
  chapterTitle: { fontSize: 16, fontWeight: '600' },
  dim: { opacity: 0.5 },
  lessons: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  lesson: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
    paddingTop: 8,
    gap: 2,
  },
  lessonHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lessonTitle: { fontSize: 15 },
  lessonState: { fontSize: 12, fontWeight: '600' },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  item: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  itemDisplay: { fontSize: 18 },
  action: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#111',
    alignItems: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '600' },
});
