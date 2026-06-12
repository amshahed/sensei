import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LessonPlayer } from './src/lesson/LessonPlayer';

// The tracer-bullet entry point (M.4): drive the seeded first lesson end-to-end.
// Navigation, lesson selection and auth gating arrive in later issues (#3, #14).
export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <LessonPlayer slug="the-five-vowels" />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
