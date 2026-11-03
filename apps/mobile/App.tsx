import { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthGate } from './src/auth/AuthGate';
import { HomeScreen } from './src/home/HomeScreen';
import { CurriculumScreen } from './src/curriculum/CurriculumScreen';
import { LessonPlayer } from './src/lesson/LessonPlayer';
import { ReviewSession } from './src/review/ReviewSession';
import { ProgressScreen } from './src/progress/ProgressScreen';
import { type Tab, TabBar } from './src/TabBar';

/** A full-screen flow launched from a tab; the tab bar hides while it runs. */
type Flow = { kind: 'lesson'; slug: string } | { kind: 'review' } | null;

// State-routed shell for the beta slice: three tabs (Home · Curriculum ·
// Progress) plus full-screen lesson / review flows that return to the tab
// they were launched from.
export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  // While a flow runs the tab screens are unmounted, so ending it remounts the
  // tab and it refetches (completions, due counts and curriculum state all
  // change during a lesson or review).
  const [flow, setFlow] = useState<Flow>(null);

  const startLesson = (slug: string) => setFlow({ kind: 'lesson', slug });
  const endFlow = () => setFlow(null);

  return (
    <SafeAreaView style={styles.container}>
      <AuthGate>
        {flow?.kind === 'lesson' ? (
          <LessonPlayer key={flow.slug} slug={flow.slug} onExit={endFlow} />
        ) : flow?.kind === 'review' ? (
          <ReviewSession onExit={endFlow} />
        ) : (
          <>
            <View style={styles.container}>
              {tab === 'home' && (
                <HomeScreen
                  onContinue={startLesson}
                  onStartReview={() => setFlow({ kind: 'review' })}
                />
              )}
              {tab === 'curriculum' && (
                <CurriculumScreen onContinue={startLesson} />
              )}
              {tab === 'progress' && <ProgressScreen />}
            </View>
            <TabBar active={tab} onSelect={setTab} />
          </>
        )}
      </AuthGate>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
