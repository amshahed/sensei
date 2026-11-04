import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  ItemType,
  ItemTypeCounts,
  PracticeScope,
  PracticeScopesDto,
  PracticeStartRequest,
} from '@sensei/types';
import { api } from '../api';
import { PrimaryButton, Screen, ui } from '../ui';
import { countFor, ITEM_TYPES, TYPE_LABELS } from './practice';

/** What the session flow needs to start a drill and label it. */
export interface PracticeLaunch {
  request: PracticeStartRequest;
  title: string;
}

/**
 * Practice Mode tab (J.1): learner-directed drill over items already learned.
 * Scope = "weakest across everything" or a module / chapter of the outline,
 * narrowed by an item-type filter (J.1.b). Order is always weakest first,
 * decided server-side — no strategy menu. Available whether or not reviews
 * are due; drilling never moves the learner forward in the course.
 */
export function PracticeScreen({
  onStart,
}: {
  onStart: (launch: PracticeLaunch) => void;
}) {
  const [data, setData] = useState<PracticeScopesDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [types, setTypes] = useState<Set<ItemType>>(() => new Set());

  const load = useCallback(() => {
    let active = true;
    setError(null);
    api
      .practiceScopes()
      .then((d) => active && setData(d))
      .catch((e: unknown) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, []);
  useEffect(load, [load]);

  if (error) {
    return (
      <View style={ui.center}>
        <Text style={ui.err}>Couldn't load practice</Text>
        <Text style={ui.hint}>{error}</Text>
        <PrimaryButton label="Retry" onPress={load} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={ui.center}>
        <ActivityIndicator />
        <Text style={ui.hint}>Loading practice…</Text>
      </View>
    );
  }

  const toggleType = (t: ItemType) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  const start = (scope: PracticeScope, title: string) =>
    onStart({
      request: { scope, ...(types.size ? { types: [...types] } : {}) },
      title,
    });

  const total = countFor(data.learned, types);
  if (countFor(data.learned, new Set()) === 0) {
    return (
      <View style={ui.center}>
        <Text style={ui.title}>Practice</Text>
        <Text style={[ui.body, styles.centered]}>
          Nothing to practise yet. Items you learn in lessons show up here to
          drill whenever you like.
        </Text>
      </View>
    );
  }

  return (
    <Screen>
      <Text style={ui.title}>Practice</Text>
      <Text style={ui.body}>
        Drill what you’ve learned, weakest first. Answers update your reviews;
        practice never moves you forward in the course.
      </Text>

      <View style={styles.chips}>
        {ITEM_TYPES.map((t) => {
          const on = types.has(t);
          const n = data.learned[t];
          return (
            <Pressable
              key={t}
              style={[
                styles.chip,
                on && styles.chipOn,
                n === 0 && ui.buttonDisabled,
              ]}
              onPress={() => toggleType(t)}
              disabled={n === 0 && !on}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: n === 0 && !on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {TYPE_LABELS[t]} · {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton
        label="Weakest across everything"
        onPress={() => start({ kind: 'weakest' }, 'Weakest items')}
        disabled={total === 0}
      />
      <Text style={ui.hint}>
        From {total} learned item{total === 1 ? '' : 's'}. Or pick a module or
        chapter:
      </Text>

      {data.modules.map((m) => (
        <View key={m.id} style={styles.module}>
          <ScopeRow
            title={m.title}
            kicker
            counts={m.learned}
            types={types}
            onPress={() => start({ kind: 'module', id: m.id }, m.title)}
          />
          {m.chapters.map((c) => (
            <ScopeRow
              key={c.id}
              title={c.title}
              counts={c.learned}
              types={types}
              onPress={() => start({ kind: 'chapter', id: c.id }, c.title)}
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function ScopeRow({
  title,
  kicker,
  counts,
  types,
  onPress,
}: {
  title: string;
  kicker?: boolean;
  counts: ItemTypeCounts;
  types: ReadonlySet<ItemType>;
  onPress: () => void;
}) {
  const n = countFor(counts, types);
  return (
    <Pressable
      style={[
        styles.row,
        kicker && styles.moduleRow,
        n === 0 && ui.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={n === 0}
      accessibilityRole="button"
      accessibilityLabel={`Practise ${title}, ${n} item${n === 1 ? '' : 's'}`}
    >
      <Text
        style={[styles.grow, kicker ? styles.moduleTitle : styles.rowTitle]}
      >
        {title}
      </Text>
      <Text style={ui.hint}>
        {n} item{n === 1 ? '' : 's'} ▸
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 14, color: '#333', fontWeight: '500' },
  chipTextOn: { color: '#fff' },
  module: { gap: 8, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },
  moduleRow: { backgroundColor: '#fff', borderColor: '#ddd' },
  grow: { flex: 1 },
  moduleTitle: { fontSize: 16, fontWeight: '700' },
  rowTitle: { fontSize: 15, fontWeight: '500' },
});
