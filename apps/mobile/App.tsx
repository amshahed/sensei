import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/home/HomeScreen';
import { LessonPlayer } from './src/lesson/LessonPlayer';
import { ReviewSession } from './src/review/ReviewSession';
import { ProgressScreen } from './src/progress/ProgressScreen';

// Tiny state-routed shell for the beta slice. Home → lesson, review, or
// progress dashboard, each returning home on exit. Proper navigation + tabs
// land in #14.
type Route = 'home' | 'lesson' | 'review' | 'progress';

export default function App() {
  const [route, setRoute] = useState<Route>('home');
  const home = () => setRoute('home');

  return (
    <SafeAreaView style={styles.container}>
      {route === 'home' && (
        <HomeScreen
          onStartLesson={() => setRoute('lesson')}
          onStartReview={() => setRoute('review')}
          onShowProgress={() => setRoute('progress')}
        />
      )}
      {route === 'lesson' && (
        <LessonPlayer slug="the-five-vowels" onExit={home} />
      )}
      {route === 'review' && <ReviewSession onExit={home} />}
      {route === 'progress' && <ProgressScreen onBack={home} />}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
