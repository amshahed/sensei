import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { PrimaryButton, ui } from '../ui';

type Mode = 'signIn' | 'signUp';

/**
 * Email/password sign-in and sign-up (L.6). Sign-up adds an email-code
 * verification step (Clerk's default). On success Clerk activates the session;
 * the AuthGate then swaps to the app. A deliberately minimal screen — richer
 * onboarding is #13.
 */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signIn');

  return (
    <View style={ui.center}>
      <Text style={ui.title}>先生 Sensei</Text>
      <Text style={ui.body}>
        {mode === 'signIn' ? 'Sign in to continue' : 'Create your account'}
      </Text>
      {mode === 'signIn' ? <SignInForm /> : <SignUpForm />}
      <Text
        style={styles.switch}
        onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
      >
        {mode === 'signIn'
          ? 'No account? Sign up'
          : 'Already have an account? Sign in'}
      </Text>
    </View>
  );
}

/**
 * Shared submit scaffold for the auth forms: tracks busy/error, blocks
 * re-entrancy, and funnels thrown errors through {@link messageFor}. Each form
 * supplies only the Clerk calls that differ.
 */
function useAuthAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
}

function SignInForm() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAuthAction();

  const submit = () =>
    run(async () => {
      if (!isLoaded) return;
      const attempt = await signIn.create({ identifier: email, password });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
      } else {
        throw new Error('Additional verification required.');
      }
    });

  return (
    <View style={styles.form}>
      <Field
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Field
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={ui.err}>{error}</Text> : null}
      <PrimaryButton
        label={busy ? 'Signing in…' : 'Sign in'}
        onPress={() => void submit()}
        disabled={busy || !email || !password}
      />
    </View>
  );
}

function SignUpForm() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingCode, setPendingCode] = useState(false);
  const { busy, error, run } = useAuthAction();

  const startSignUp = () =>
    run(async () => {
      if (!isLoaded) return;
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingCode(true);
    });

  const verify = () =>
    run(async () => {
      if (!isLoaded) return;
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
      } else {
        throw new Error('Verification incomplete. Check the code and try again.');
      }
    });

  if (pendingCode) {
    return (
      <View style={styles.form}>
        <Text style={ui.hint}>We emailed a verification code to {email}.</Text>
        <Field
          placeholder="Verification code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
        />
        {error ? <Text style={ui.err}>{error}</Text> : null}
        <PrimaryButton
          label={busy ? 'Verifying…' : 'Verify'}
          onPress={() => void verify()}
          disabled={busy || !code}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Field
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Field
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={ui.err}>{error}</Text> : null}
      <PrimaryButton
        label={busy ? 'Creating…' : 'Sign up'}
        onPress={() => void startSignUp()}
        disabled={busy || !email || !password}
      />
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      style={styles.input}
      placeholderTextColor="#999"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

/**
 * Clerk errors carry a user-friendly message in `errors[0].message`; our own
 * thrown Errors (non-complete auth states) carry it on `.message`.
 */
function messageFor(e: unknown): string {
  const err = e as { errors?: { message?: string }[] };
  if (err?.errors?.[0]?.message) {
    return err.errors[0].message;
  }
  if (e instanceof Error && e.message) {
    return e.message;
  }
  return 'Something went wrong. Try again.';
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 360, gap: 12, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  switch: { marginTop: 16, color: '#555', fontSize: 15 },
});
