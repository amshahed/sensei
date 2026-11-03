import { Pressable, StyleSheet, Text, View } from 'react-native';

export type Tab = 'home' | 'curriculum' | 'progress';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'progress', label: 'Progress' },
];

/**
 * Bottom tab bar for the main nav (I.4.e: the Curriculum tab is always
 * reachable). Hand-rolled to keep the beta free of a navigation dependency;
 * full-screen flows (lesson player, review session) hide it.
 */
export function TabBar({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((t) => {
        const selected = t.id === active;
        return (
          <Pressable
            key={t.id}
            style={styles.tab}
            onPress={() => onSelect(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.selected]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  label: { fontSize: 14, color: '#888', fontWeight: '500' },
  selected: { color: '#111', fontWeight: '700' },
});
