import React, {createContext, useContext, useEffect, useState} from 'react';
import {Session, User} from '@supabase/supabase-js';
import {supabase} from '../lib/supabase';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {WEB_CLIENTID} from '@env';

// Configure Google Sign-In once
GoogleSignin.configure({
  webClientId: WEB_CLIENTID,
  scopes: ['profile', 'email'],
});

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({data: {session}}) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const {error} = await supabase.auth.signInWithPassword({email, password});
    return error?.message ?? null;
  };

  const signUp = async (email: string, password: string): Promise<string | null> => {
    const {error} = await supabase.auth.signUp({email, password});
    return error?.message ?? null;
  };

  const signInWithGoogle = async (): Promise<string | null> => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      console.log('=== GOOGLE SIGNIN RESPONSE ===');
      console.log(JSON.stringify(response, null, 2));
      console.log('==============================');
      const idToken = response.data?.idToken;
      if (!idToken) return 'Google Sign-In failed — no token received.';

      const {error} = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      return error?.message ?? null;
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
        return 'Google Play Services not available.';
      return error.message ?? 'Google Sign-In failed.';
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    try { await GoogleSignin.signOut(); } catch {}
  };

  return (
    <AuthContext.Provider value={{user, session, loading, signIn, signUp, signInWithGoogle, signOut}}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
