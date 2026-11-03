import { Pressable, Text } from 'react-native';
import { PrimaryButton, Screen, ui } from '../ui';

/**
 * Chapter entry (I.4.d): before the first lesson of a chapter, offer the
 * optional skip-test — never forced.
 */
export function ChapterIntro({
  chapterTitle,
  onSkipTest,
  onStart,
  onExit,
}: {
  chapterTitle: string;
  onSkipTest: () => void;
  onStart: () => void;
  onExit: () => void;
}) {
  return (
    <Screen footer={<PrimaryButton label="Start chapter" onPress={onStart} />}>
      <Text style={ui.kicker}>New chapter</Text>
      <Text style={ui.title}>{chapterTitle}</Text>
      <Text style={ui.body}>
        Already know this? A ~5-minute skip test lets you jump past it. Not
        passing costs nothing.
      </Text>
      <PrimaryButton label="Take the skip test" onPress={onSkipTest} />
      <Pressable onPress={onExit} accessibilityRole="button">
        <Text style={ui.hint}>Back</Text>
      </Pressable>
    </Screen>
  );
}
