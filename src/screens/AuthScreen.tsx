import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import {useAuth} from '../context/AuthContext';

export default function AuthScreen() {
  const {signIn, signUp} = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setSuccess('Account created! Please check your email to confirm, then log in.');
      setMode('login');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}
          keyboardShouldPersistTaps="handled">
          <View className="px-6">
            {/* Header */}
            <View className="items-center mb-8">
              <View className="w-16 h-16 rounded-2xl bg-teal-500 items-center justify-center mb-4">
                <Text className="text-white text-3xl font-bold">M</Text>
              </View>
              <Text className="text-gray-800 text-2xl font-bold">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </Text>
              <Text className="text-gray-400 text-sm mt-1 text-center">
                {mode === 'login'
                  ? 'Sign in to sync your health data'
                  : 'Register to back up and sync your data'}
              </Text>
            </View>

            {/* Form */}
            <View className="bg-white rounded-2xl p-5 shadow-sm gap-4">
              <View>
                <Text className="text-gray-700 text-sm font-medium mb-1">Email</Text>
                <TextInput
                  value={email}
                  onChangeText={v => { setEmail(v); setError(null); }}
                  placeholder="you@email.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
                />
              </View>
              <View>
                <Text className="text-gray-700 text-sm font-medium mb-1">Password</Text>
                <TextInput
                  value={password}
                  onChangeText={v => { setPassword(v); setError(null); }}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
                />
              </View>

              {error && (
                <Text className="text-red-400 text-xs">{error}</Text>
              )}
              {success && (
                <Text className="text-teal-500 text-xs">{success}</Text>
              )}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                className="bg-teal-500 rounded-xl py-3.5 items-center mt-1">
                {loading
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text className="text-white font-semibold text-base">
                      {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </Text>
                }
              </TouchableOpacity>
            </View>

            {/* Toggle mode */}
            <TouchableOpacity
              onPress={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(null); setSuccess(null); }}
              className="items-center mt-4">
              <Text className="text-gray-400 text-sm">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <Text className="text-teal-500 font-semibold">
                  {mode === 'login' ? 'Register' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
