import React, {useRef, useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform,
  ScrollView, Animated, PanResponder,
  ActivityIndicator,
} from 'react-native';
import {useAuth} from '../context/AuthContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AuthModal({visible, onClose}: Props) {
  const {signIn, signUp, signInWithGoogle} = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    setEmail('');
    setPassword('');
    setError(null);
    setSuccess(null);
    setMode('login');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    const err = mode === 'login'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err);
    } else if (mode === 'register') {
      setSuccess('Account created! Check your email to confirm, then sign in.');
      setMode('login');
    } else {
      handleClose();
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const err = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) {
      setError(err);
    } else {
      handleClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{flex: 1, justifyContent: 'flex-end'}}>

        {/* Overlay */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#000',
            opacity: overlayOpacity,
          }}
        />

        {/* Tap outside to close */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          style={{flex: 1}}
        />

        {/* Sheet */}
        <Animated.View
          style={{
            transform: [{translateY: dragY}],
            backgroundColor: 'white',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
          }}>

          {/* Drag handle */}
          <View
            {...dragPan.panHandlers}
            style={{alignItems: 'center', paddingTop: 12, paddingBottom: 4}}>
            <View style={{width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB'}} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal: 24, paddingBottom: 40}}>

            {/* Header */}
            <Text style={{fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4, marginTop: 8}}>
              {mode === 'login' ? 'Sign in to sync' : 'Create account'}
            </Text>
            <Text style={{fontSize: 12, color: '#9ca3af', marginBottom: 20}}>
              {mode === 'login'
                ? 'Back up and sync your health data across devices.'
                : 'Register to enable cloud backup and sync.'}
            </Text>

            {/* Google Button */}
            <TouchableOpacity
              onPress={handleGoogle}
              disabled={googleLoading}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                paddingVertical: 12,
                marginBottom: 16,
                backgroundColor: '#fff',
              }}>
              {googleLoading
                ? <ActivityIndicator color="#14B8A6" />
                : <>
                    <Text style={{fontSize: 16, fontWeight: '700', color: '#4285F4'}}>G</Text>
                    <Text style={{fontSize: 14, fontWeight: '600', color: '#374151'}}>
                      Continue with Google
                    </Text>
                  </>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8}}>
              <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}} />
              <Text style={{fontSize: 12, color: '#9ca3af'}}>or</Text>
              <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}} />
            </View>

            {/* Email */}
            <Text style={{fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4}}>Email</Text>
            <TextInput
              value={email}
              onChangeText={v => { setEmail(v); setError(null); }}
              placeholder="you@email.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12,
                fontSize: 14, color: '#1f2937', marginBottom: 12,
              }}
            />

            {/* Password */}
            <Text style={{fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4}}>Password</Text>
            <TextInput
              value={password}
              onChangeText={v => { setPassword(v); setError(null); }}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              style={{
                borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12,
                fontSize: 14, color: '#1f2937', marginBottom: 12,
              }}
            />

            {/* Error / Success */}
            {error && <Text style={{fontSize: 12, color: '#f87171', marginBottom: 8}}>{error}</Text>}
            {success && <Text style={{fontSize: 12, color: '#14B8A6', marginBottom: 8}}>{success}</Text>}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
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
              onPress={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(null); setSuccess(null); }}
              style={{alignItems: 'center'}}>
              <Text style={{fontSize: 13, color: '#9ca3af'}}>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <Text style={{color: '#14B8A6', fontWeight: '600'}}>
                  {mode === 'login' ? 'Register' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
