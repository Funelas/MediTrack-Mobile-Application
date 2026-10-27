import React, {useRef, useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform,
  ScrollView, Animated, PanResponder,
  ActivityIndicator,
} from 'react-native';
import {useAuth} from '../context/AuthContext';
import EyeOpen from '../assets/svg_icons/eye-svgrepo-com.svg';
import EyeClosed from '../assets/svg_icons/eye-closed-svgrepo-com.svg';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function EyeIcon({visible}: {visible: boolean}) {
  return visible
    ? <EyeOpen width={20} height={20} color="#9ca3af" />
    : <EyeClosed width={20} height={20} color="#9ca3af" />;
}

// Defined outside AuthModal to prevent remounting on every keystroke
function PasswordInput({
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  show: boolean;
  onToggleShow: (v: boolean) => void;
  error?: string | null;
}) {
  return (
    <>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: error ? '#f87171' : '#E5E7EB',
        borderRadius: 12,
        marginBottom: error ? 4 : 12,
        paddingHorizontal: 16,
      }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          secureTextEntry={!show}
          style={{
            flex: 1,
            paddingVertical: 12,
            fontSize: 14,
            color: '#1f2937',
          }}
        />
        <TouchableOpacity
          onPressIn={() => onToggleShow(true)}
          onPressOut={() => onToggleShow(false)}
          style={{padding: 4}}>
          <EyeIcon visible={show} />
        </TouchableOpacity>
      </View>
      {error ? <Text style={{fontSize: 11, color: '#f87171', marginBottom: 12}}>{error}</Text> : null}
    </>
  );
}

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function AuthModal({visible, onClose}: Props) {
  const {signIn, signUp, signInWithGoogle, verifyOtp} = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [otp, setOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const dragY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = dragY.interpolate({
    inputRange: [0, 300],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });

  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          handleClose();
          Animated.timing(dragY, {toValue: 1000, duration: 150, useNativeDriver: true}).start(() => {
            dragY.setValue(0);
          });
        } else {
          Animated.spring(dragY, {toValue: 0, useNativeDriver: true}).start();
        }
      },
    })
  ).current;

  const reset = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFieldErrors({});
    setOtp('');
    setServerError(null);
    setMode('login');
    setStep('form');
    setPendingEmail('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateEmail = (val: string) => {
    if (!val.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Enter a valid email address.';
    return null;
  };

  const validatePassword = (val: string) => {
    if (!val) return 'Password is required.';
    if (val.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const handleSubmit = async () => {
    setServerError(null);

    // Validate all fields
    const errors: FieldErrors = {};

    if (mode === 'register' && !name.trim()) {
      errors.name = 'Full name is required.';
    }

    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;

    const passwordErr = validatePassword(password);
    if (passwordErr) errors.password = passwordErr;

    if (mode === 'register') {
      if (!confirmPassword) {
        errors.confirmPassword = 'Please confirm your password.';
      } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    if (mode === 'register') {
      const err = await signUp(email.trim(), password, name.trim());
      setLoading(false);
      if (err) { setServerError(err); return; }
      setPendingEmail(email.trim());
      setStep('otp');
    } else {
      const err = await signIn(email.trim(), password);
      setLoading(false);
      if (err) { setServerError(err); return; }
      handleClose();
    }
  };

  const handleVerifyOtp = async () => {
    setServerError(null);
    if (!otp.trim()) { setServerError('Please enter the code.'); return; }
    setLoading(true);
    const err = await verifyOtp(pendingEmail, otp.trim());
    setLoading(false);
    if (err) { setServerError(err); return; }
    handleClose();
  };

  const handleGoogle = async () => {
    setServerError(null);
    setGoogleLoading(true);
    const err = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) setServerError(err);
    else handleClose();
  };

  const clearFieldError = (field: keyof FieldErrors) =>
    setFieldErrors(prev => ({...prev, [field]: undefined}));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{flex: 1, justifyContent: 'flex-end'}}>

        {/* Overlay */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#000', opacity: overlayOpacity,
          }}
        />

        {/* Tap outside to close */}
        <TouchableOpacity activeOpacity={1} onPress={handleClose} style={{flex: 1}} />

        {/* Sheet */}
        <Animated.View style={{
          transform: [{translateY: dragY}],
          backgroundColor: 'white',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          overflow: 'hidden',
        }}>

          {/* Drag handle */}
          <View {...dragPan.panHandlers} style={{alignItems: 'center', paddingTop: 12, paddingBottom: 4}}>
            <View style={{width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB'}} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal: 24, paddingBottom: 40}}>

            {step === 'otp' ? (
              <>
                <Text style={{fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4, marginTop: 8}}>
                  Check your email
                </Text>
                <Text style={{fontSize: 12, color: '#9ca3af', marginBottom: 20}}>
                  We sent a 6-digit code to {pendingEmail}. Enter it below to verify your account.
                </Text>
                <Text style={{fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4}}>
                  Verification Code
                </Text>
                <TextInput
                  value={otp}
                  onChangeText={v => { setOtp(v); setServerError(null); }}
                  placeholder="000000"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={6}
                  style={{
                    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    fontSize: 24, color: '#1f2937', marginBottom: 12,
                    textAlign: 'center', letterSpacing: 8,
                  }}
                />
                {serverError && <Text style={{fontSize: 12, color: '#f87171', marginBottom: 8}}>{serverError}</Text>}
                <TouchableOpacity
                  onPress={handleVerifyOtp} disabled={loading}
                  style={{backgroundColor: '#14B8A6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 14}}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={{color: '#fff', fontWeight: '600', fontSize: 15}}>Verify</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setStep('form'); setServerError(null); }} style={{alignItems: 'center'}}>
                  <Text style={{fontSize: 13, color: '#9ca3af'}}>
                    Wrong email?{' '}
                    <Text style={{color: '#14B8A6', fontWeight: '600'}}>Go back</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4, marginTop: 8}}>
                  {mode === 'login' ? 'Sign in to sync' : 'Create account'}
                </Text>
                <Text style={{fontSize: 12, color: '#9ca3af', marginBottom: 20}}>
                  {mode === 'login'
                    ? 'Back up and sync your health data across devices.'
                    : 'Register to enable cloud backup and sync.'}
                </Text>

                {/* Google */}
                <TouchableOpacity
                  onPress={handleGoogle} disabled={googleLoading}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 10, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
                    paddingVertical: 12, marginBottom: 16, backgroundColor: '#fff',
                  }}>
                  {googleLoading
                    ? <ActivityIndicator color="#14B8A6" />
                    : <>
                        <Text style={{fontSize: 16, fontWeight: '700', color: '#4285F4'}}>G</Text>
                        <Text style={{fontSize: 14, fontWeight: '600', color: '#374151'}}>Continue with Google</Text>
                      </>
                  }
                </TouchableOpacity>

                {/* Divider */}
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8}}>
                  <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}} />
                  <Text style={{fontSize: 12, color: '#9ca3af'}}>or</Text>
                  <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}} />
                </View>

                {/* Full Name — register only */}
                {mode === 'register' && (
                  <>
                    <Text style={{fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4}}>Full Name</Text>
                    <TextInput
                      value={name}
                      onChangeText={v => { setName(v); clearFieldError('name'); }}
                      placeholder="Juan dela Cruz"
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="words"
                      style={{
                        borderWidth: 1,
                        borderColor: fieldErrors.name ? '#f87171' : '#E5E7EB',
                        borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                        fontSize: 14, color: '#1f2937',
                        marginBottom: fieldErrors.name ? 4 : 12,
                      }}
                    />
                    {fieldErrors.name && (
                      <Text style={{fontSize: 11, color: '#f87171', marginBottom: 12}}>{fieldErrors.name}</Text>
                    )}
                  </>
                )}

                {/* Email */}
                <Text style={{fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4}}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={v => { setEmail(v); clearFieldError('email'); }}
                  placeholder="you@email.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1,
                    borderColor: fieldErrors.email ? '#f87171' : '#E5E7EB',
                    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                    fontSize: 14, color: '#1f2937',
                    marginBottom: fieldErrors.email ? 4 : 12,
                  }}
                />
                {fieldErrors.email && (
                  <Text style={{fontSize: 11, color: '#f87171', marginBottom: 12}}>{fieldErrors.email}</Text>
                )}

                {/* Password */}
                <Text style={{fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4}}>Password</Text>
                <PasswordInput
                  value={password}
                  onChange={v => { setPassword(v); clearFieldError('password'); }}
                  placeholder="••••••••"
                  show={showPassword}
                  onToggleShow={setShowPassword}
                  error={fieldErrors.password}
                />

                {/* Confirm Password — register only */}
                {mode === 'register' && (
                  <>
                    <Text style={{fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4}}>
                      Confirm Password
                    </Text>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={v => { setConfirmPassword(v); clearFieldError('confirmPassword'); }}
                      placeholder="••••••••"
                      show={showConfirmPassword}
                      onToggleShow={setShowConfirmPassword}
                      error={fieldErrors.confirmPassword}
                    />
                  </>
                )}

                {/* Server error */}
                {serverError && (
                  <Text style={{fontSize: 12, color: '#f87171', marginBottom: 8}}>{serverError}</Text>
                )}

                {/* Submit */}
                <TouchableOpacity
                  onPress={handleSubmit} disabled={loading}
                  style={{
                    backgroundColor: '#14B8A6', borderRadius: 12,
                    paddingVertical: 14, alignItems: 'center', marginBottom: 14,
                  }}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{color: '#fff', fontWeight: '600', fontSize: 15}}>
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                      </Text>
                  }
                </TouchableOpacity>

                {/* Toggle mode */}
                <TouchableOpacity
                  onPress={() => {
                    setMode(m => m === 'login' ? 'register' : 'login');
                    setFieldErrors({});
                    setServerError(null);
                  }}
                  style={{alignItems: 'center'}}>
                  <Text style={{fontSize: 13, color: '#9ca3af'}}>
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <Text style={{color: '#14B8A6', fontWeight: '600'}}>
                      {mode === 'login' ? 'Register' : 'Sign In'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
