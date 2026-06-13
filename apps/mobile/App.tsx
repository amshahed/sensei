import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/home/HomeScreen';
import { LessonPlayer } from './src/lesson/LessonPlayer';
import { ReviewSession } from './src/review/ReviewSession';

// Tiny state-routed shell for the beta slice. Home → lesson or review, each
// returning home on exit. Proper navigation + curriculum outline land in #14.
type Route = 'home' | 'lesson' | 'review';

export default function App() {
  const [route, setRoute] = useState<Route>('home');
  const home = () => setRoute('home');

  return (
    <SafeAreaView style={styles.container}>
      {route === 'home' && (
        <HomeScreen
          onStartLesson={() => setRoute('lesson')}
          onStartReview={() => setRoute('review')}
        />
      )}
      {route === 'lesson' && (
        <LessonPlayer slug="the-five-vowels" onExit={home} />
      )}
      {route === 'review' && <ReviewSession onExit={home} />}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
