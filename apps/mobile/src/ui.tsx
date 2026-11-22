import { useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * A scrollable content area with an optional pinned footer (CTA).
 *
 * `avoidKeyboard` (opt-in, B.2.d) is for a screen whose last thing is a
 * multi-line answer box: the footer, and so its button, rises above the
 * keyboard, and while the keyboard is up the end of the content stays in
 * view as the box grows. There is no header above a Screen, so no offset.
 */
export function Screen({
  children,
  footer,
  avoidKeyboard = false,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  avoidKeyboard?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  const keyboardUp = useRef(false);

  useEffect(() => {
    if (!avoidKeyboard) return;
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      keyboardUp.current = true;
      scroll.current?.scrollToEnd({ animated: true });
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardUp.current = false;
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [avoidKeyboard]);

  const content = (
    <>
      <ScrollView
        ref={scroll}
        contentContainerStyle={ui.scroll}
        onContentSizeChange={
          avoidKeyboard
            ? () => {
                if (keyboardUp.current) {
                  scroll.current?.scrollToEnd({ animated: false });
                }
              }
            : undefined
        }
      >
        {children}
      </ScrollView>
      {footer ? <View style={ui.footer}>{footer}</View> : null}
    </>
  );

  return avoidKeyboard ? (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    <View style={ui.screen}>{content}</View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[ui.button, disabled && ui.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={ui.buttonText}>{label}</Text>
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, gap: 12, paddingBottom: 24 },
  center: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  kicker: {
    fontSize: 13,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, color: '#333' },
  hint: { fontSize: 13, color: '#999' },
  ok: { fontSize: 16, color: '#0E8A16', fontWeight: '600' },
  err: { fontSize: 15, color: '#B60205', fontWeight: '600' },
  button: {
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
