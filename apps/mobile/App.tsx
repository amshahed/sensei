import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { HealthResponse } from '@sensei/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/health`)
      .then((r) => r.json() as Promise<HealthResponse>)
      .then((data) => active && setState({ kind: 'ok', data }))
      .catch((e) => active && setState({ kind: 'error', message: String(e) }));
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>先生 Sensei</Text>

      {state.kind === 'loading' && <ActivityIndicator />}

      {state.kind === 'ok' && (
        <Text style={styles.ok}>
          API {state.data.status} · {state.data.service}
        </Text>
      )}

      {state.kind === 'error' && (
        <Text style={styles.err}>
          API unreachable:{'\n'}
          {state.message}
        </Text>
      )}

      <Text style={styles.hint}>{API_URL}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  title: { fontSize: 28, fontWeight: '600' },
  ok: { fontSize: 16, color: '#0E8A16' },
  err: { fontSize: 14, color: '#B60205', textAlign: 'center' },
  hint: { fontSize: 12, color: '#999' },
});
