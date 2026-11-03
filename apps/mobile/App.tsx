import { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NextStepDto } from '@sensei/types';
import { AuthGate } from './src/auth/AuthGate';
import { HomeScreen } from './src/home/HomeScreen';
import { CurriculumScreen } from './src/curriculum/CurriculumScreen';
import { AssessmentScreen } from './src/assessment/AssessmentScreen';
import { ChapterIntro } from './src/assessment/ChapterIntro';
import { LessonPlayer } from './src/lesson/LessonPlayer';
import { ReviewSession } from './src/review/ReviewSession';
import { ProgressScreen } from './src/progress/ProgressScreen';
import {
  type PracticeLaunch,
  PracticeScreen,
} from './src/practice/PracticeScreen';
import { PracticeSession } from './src/practice/PracticeSession';
import { TYPE_LABELS } from './src/practice/practice';
import { type Tab, TabBar } from './src/TabBar';

type LessonStep = Extract<NextStepDto, { kind: 'lesson' }>;

/** A full-screen flow launched from a tab; the tab bar hides while it runs. */
type Flow =
  | { kind: 'lesson'; slug: string }
  | { kind: 'chapterIntro'; step: LessonStep }
  | { kind: 'assessment'; chapterId: string }
  | { kind: 'review' }
  | { kind: 'practice'; launch: PracticeLaunch }
  | null;

// State-routed shell for the beta slice: four tabs (Home · Curriculum ·
// Practice · Progress) plus full-screen flows (lesson, chapter intro,
// Assessment, review, practice drill) that return to the tab they were
// launched from.
export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  // While a flow runs the tab screens are unmounted, so ending it remounts the
  // tab and it refetches (completions, due counts and curriculum state all
  // change during a lesson, Assessment or review).
  const [flow, setFlow] = useState<Flow>(null);
  const endFlow = () => setFlow(null);
  const startAssessment = (chapterId: string) =>
    setFlow({ kind: 'assessment', chapterId });
  const startPractice = (launch: PracticeLaunch) =>
    setFlow({ kind: 'practice', launch });

  /** "Continue": the next lesson — via the chapter-entry skip-test offer (I.4.d) — or the exit Assessment. */
  const continueWith = (step: NextStepDto) => {
    if (step.kind === 'assessment') startAssessment(step.chapterId);
    else if (step.chapterStart) setFlow({ kind: 'chapterIntro', step });
    else setFlow({ kind: 'lesson', slug: step.slug });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AuthGate>
        {flow?.kind === 'lesson' ? (
          <LessonPlayer key={flow.slug} slug={flow.slug} onExit={endFlow} />
        ) : flow?.kind === 'chapterIntro' ? (
          <ChapterIntro
            chapterTitle={flow.step.chapterTitle}
            onSkipTest={() => startAssessment(flow.step.chapterId)}
            onStart={() => setFlow({ kind: 'lesson', slug: flow.step.slug })}
            onExit={endFlow}
          />
        ) : flow?.kind === 'assessment' ? (
          <AssessmentScreen
            key={flow.chapterId}
            chapterId={flow.chapterId}
            onExit={endFlow}
          />
        ) : flow?.kind === 'review' ? (
          <ReviewSession onExit={endFlow} />
        ) : flow?.kind === 'practice' ? (
          <PracticeSession
            request={flow.launch.request}
            title={flow.launch.title}
            onExit={endFlow}
          />
        ) : (
          <>
            <View style={styles.container}>
              {tab === 'home' && (
                <HomeScreen
                  onContinue={continueWith}
                  onStartReview={() => setFlow({ kind: 'review' })}
                />
              )}
              {tab === 'curriculum' && (
                <CurriculumScreen
                  onContinue={continueWith}
                  onAssessment={startAssessment}
                  onPractice={(chapterId, title) =>
                    startPractice({
                      request: { scope: { kind: 'chapter', id: chapterId } },
                      title,
                    })
                  }
                />
              )}
              {tab === 'practice' && <PracticeScreen onStart={startPractice} />}
              {tab === 'progress' && (
                <ProgressScreen
                  // J.2.b: a weak item type links straight to a drill of it.
                  onPractice={(type) =>
                    startPractice({
                      request: { scope: { kind: 'weakest' }, types: [type] },
                      title: `${TYPE_LABELS[type]} practice`,
                    })
                  }
                />
              )}
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
