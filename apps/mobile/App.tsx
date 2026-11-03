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
  const [flow, setFlow] = useState<Flow>(null);
  // Bumped when a flow ends so the tab remounts and refetches (completions,
  // due counts, curriculum state all change during a lesson or review).
  const [epoch, setEpoch] = useState(0);

  const startLesson = (slug: string) => setFlow({ kind: 'lesson', slug });
  const endFlow = () => {
    setFlow(null);
    setEpoch((e) => e + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AuthGate>
        {flow?.kind === 'lesson' ? (
          <LessonPlayer key={flow.slug} slug={flow.slug} onExit={endFlow} />
        ) : flow?.kind === 'review' ? (
          <ReviewSession onExit={endFlow} />
        ) : (
          <>
            <View style={styles.container} key={`${tab}:${epoch}`}>
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
