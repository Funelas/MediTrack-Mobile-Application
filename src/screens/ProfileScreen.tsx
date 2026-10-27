import React, {useState, useEffect} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  SafeAreaView, Switch, Alert, ActivityIndicator, Image
} from 'react-native';
import AuthModal from '../components/AuthModal';
import Bell from '../assets/svg_icons/bell.svg';
import QR from '../assets/svg_icons/qr.svg';
import Heart from '../assets/svg_icons/heart.svg';
import Pills from '../assets/svg_icons/pills.svg';
import Arrow from '../assets/svg_icons/arrow.svg';
import {useAuth} from '../context/AuthContext';
import {syncDatabase, pushAllToRemote} from '../sync/syncService';
import NetInfo from '@react-native-community/netinfo';
import EditProfileModal from '../components/EditProfileModal';
import {cacheGoogleAvatar} from '../services/avatarService';
// Placeholder data
const USER = {
  name: 'Juan dela Cruz',
  email: 'juan.delacruz@email.com',
  age: 45,
  bloodType: 'O+',
};

const DOCTORS = [
  {id: '1', name: 'Dr. Maria Gaston', specialty: 'Cardiology', clinic: 'Cardiology Clinics'},
  {id: '2', name: 'Dr. Ramon Santos', specialty: 'Endocrinology', clinic: 'Metro Health Center'},
];

const DEVICES = [
  {id: '1', name: 'Smart Pill Dispenser', type: 'Pill Dispenser', status: 'connected'},
  {id: '2', name: 'BP Monitor Pro', type: 'Blood Pressure Monitor', status: 'connected'},
];

type RowProps = {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
};

function SettingRow({icon, iconBg, label, value, onPress, rightElement}: RowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className="flex-row items-center gap-2 px-4 py-3.5">
      <View className="w-9 h-9 rounded-xl items-center justify-center" style={{backgroundColor: iconBg}}>
        {icon}
      </View>
      <Text className="flex-1 text-gray-800 text-sm font-medium">{label}</Text>
      {value && <Text className="text-gray-400 text-sm mr-1">{value}</Text>}
      {rightElement ?? (
        onPress && (
          <View style={{transform: [{rotate: '270deg'}]}}>
            <Arrow width={16} height={16} />
          </View>
        )
      )}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View className="h-px bg-gray-100 ml-16" />;
}

export default function ProfileScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [lowStockEnabled, setLowStockEnabled] = useState(true);
  const {user, signOut} = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    console.log('[Avatar] user_metadata:', JSON.stringify(user.user_metadata, null, 2));
    const googlePicture = user.user_metadata?.picture
      ?? user.user_metadata?.avatar_url
      ?? user.user_metadata?.photo;
    const storedAvatar = user.user_metadata?.avatar_url;

    if (storedAvatar && !storedAvatar.includes('googleusercontent')) {
      // Only use stored avatar if it's our own Supabase URL, not Google's
      setAvatarUrl(storedAvatar);
    } else if (googlePicture) {
      console.log('[Avatar] Caching Google photo for user:', user.id, googlePicture);
      cacheGoogleAvatar(user.id, googlePicture)
        .then(url => {
          console.log('[Avatar] Cached URL:', url);
          setAvatarUrl(url);
        })
        .catch(e => {
          console.log('[Avatar] Cache failed:', e.message);
          setAvatarUrl(googlePicture);
        });
    } else {
      console.log('[Avatar] No photo found in user_metadata');
    }
  }, [user]);
  const handleSync = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setSyncing(true);
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected || !netState.isInternetReachable) {
        Alert.alert('No Internet', 'Changes are saved locally and will sync when you reconnect.');
        return;
      }
      await pushAllToRemote(user.id);
      setLastSynced(new Date());
      Alert.alert('Sync Complete', 'Your data has been synced successfully.');
    } catch (e: any) {
      Alert.alert('Sync Failed', e.message ?? 'Something went wrong.');
    } finally {
      setSyncing(false);
    }
  };
  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-teal-500 px-5 pt-10 pb-8 rounded-b-3xl mb-2">
          <Text className="text-white text-2xl font-bold">Profile</Text>
          <Text className="text-teal-100 text-sm mt-1">Manage your account and preferences.</Text>
        </View>

        {/* Avatar Card */}
        <View className="px-4 mb-4">
          {!user ? (
            // ── Not logged in ──
            <View className="bg-white rounded-2xl p-5 shadow-sm items-center gap-3 ml-1">
              <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center">
                <Text className="text-3xl">☁️</Text>
              </View>
              <View className="items-center">
                <Text className="text-gray-800 text-base font-bold">Back up your data</Text>
                <Text className="text-gray-400 text-xs text-center mt-1 px-4">
                  Sign in to sync your medicines, schedules, and checkup results across devices.
                </Text>
              </View>
              <TouchableOpacity
                 onPress={() => setShowAuthModal(true)}
                className="bg-teal-500 rounded-xl px-6 py-2.5 mt-1">
                <Text className="text-white text-sm font-semibold">Sign In / Register</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ── Logged in ──
            <View className="bg-white rounded-2xl p-3 shadow-sm gap-3 ml-1">
              <View className="flex-row items-center gap-x-4">
              <TouchableOpacity onPress={() => setShowEditModal(true)} activeOpacity={0.8}>
                {avatarUrl ? (
                  <Image
                    source={{uri: avatarUrl}}
                    style={{width: 64, height: 64, borderRadius: 32, backgroundColor: '#CCFBF1'}}
                  />
                ) : (
                  <View className="w-16 h-16 rounded-full bg-teal-100 items-center justify-center">
                    <Text className="text-teal-600 text-2xl font-bold">
                      {(user.user_metadata?.given_name ?? user.email ?? '?')
                        .replace(/\w\S*/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                        .slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
                <View className="flex-1">
                  <Text className="text-gray-800 text-base font-bold">
                    {(user.user_metadata?.full_name ?? user.user_metadata?.given_name ?? 'User')
                      .replace(/\w\S*/g, (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())}
                  </Text>
                  <Text className="text-gray-400 text-xs mt-0.5">{user.email}</Text>
                  <View className="flex-row items-center gap-1.5 mt-1">
                    <View
                      style={{
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: lastSynced ? '#34d399' : '#d1d5db',
                      }}
                    />
                    <Text className="text-gray-400 text-xs">
                      {lastSynced
                        ? `Last synced at ${lastSynced.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true})}`
                        : 'Not yet synced'}
                    </Text>
                  </View>
                </View>
              </View>
              {/* Sync button inside the card */}
              <TouchableOpacity
                onPress={handleSync}
                disabled={syncing}
                className="flex-row items-center justify-center gap-2 bg-teal-50 rounded-xl py-2.5">
                {syncing
                  ? <ActivityIndicator size="small" color="#14B8A6" />
                  : <Text className="text-teal-500 text-sm">↑↓</Text>
                }
                <Text className="text-teal-500 text-sm font-semibold">
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View className="px-4 gap-4 pb-8">

          {/* Doctor Connection */}
          <View>
            <View className="flex-row justify-between items-center mb-2 ml-1 mr-1">
              <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                Doctor Connection
              </Text>
              <TouchableOpacity className="flex-row items-center gap-1">
                <Text className="text-teal-500 text-xs font-semibold">+ Add</Text>
              </TouchableOpacity>
            </View>
            {DOCTORS.length === 0 ? (
              <View className="bg-white rounded-2xl px-4 py-5 items-center gap-3 shadow-sm">
                <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center">
                  <Heart width={28} height={28} color="#9ca3af" />
                </View>
                <View className="items-center">
                  <Text className="text-gray-800 text-sm font-semibold">No Doctor Connected</Text>
                  <Text className="text-gray-400 text-xs mt-1 text-center">
                    Connect your doctor to share your health data securely.
                  </Text>
                </View>
                <View className="flex-row gap-3 mt-1">
                  <TouchableOpacity className="flex-row items-center gap-1.5 border border-teal-500 rounded-xl px-4 py-2.5">
                    <QR width={16} height={16} color="#14B8A6" />
                    <Text className="text-teal-500 text-sm font-semibold">Scan QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="bg-teal-500 rounded-xl px-4 py-2.5">
                    <Text className="text-white text-sm font-semibold">Enter Invite Code</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="gap-3">
                {DOCTORS.map(doctor => (
                  <View key={doctor.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                    <View className="px-4 py-4 flex-row items-center gap-3">
                      <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
                        <Heart width={24} height={24} color="#3B82F6" />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-gray-800 text-sm font-semibold">{doctor.name}</Text>
                          <View className="bg-teal-100 rounded-full px-2 py-0.5">
                            <Text className="text-teal-600 text-xs font-medium">Connected</Text>
                          </View>
                        </View>
                        <Text className="text-gray-400 text-xs mt-0.5">
                          {doctor.specialty} · {doctor.clinic}
                        </Text>
                      </View>
                    </View>
                    <View className="px-4 py-3 bg-teal-50 flex-row items-center gap-2">
                      <Heart width={14} height={14} color="#14B8A6" />
                      <Text className="text-teal-700 text-xs flex-1">
                        Read-only access to your reports and medicines.
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* My Devices */}
          <View>
            <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 ml-1">
              My Devices
            </Text>
            <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {DEVICES.map((device, index) => (
                <View key={device.id}>
                  <View className="flex-row items-center gap-3 px-4 py-3.5">
                    <View className="w-9 h-9 rounded-xl bg-purple-100 items-center justify-center">
                      <Pills width={18} height={18} color="#8B5CF6" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-800 text-sm font-medium">{device.name}</Text>
                      <Text className="text-gray-400 text-xs mt-0.5">{device.type}</Text>
                    </View>
                    <View className="bg-teal-100 rounded-full px-2 py-0.5">
                      <Text className="text-teal-600 text-xs font-medium capitalize">{device.status}</Text>
                    </View>
                  </View>
                  {index < DEVICES.length - 1 && <View className="h-px bg-gray-100 ml-16" />}
                </View>
              ))}
              <View className="h-px bg-gray-100" />
              <TouchableOpacity className="flex-row items-center justify-center gap-2 py-3.5">
                <Text className="text-teal-500 text-sm font-semibold">+ Pair New Device</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notifications */}
          <View>
            <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 ml-1">
              Notifications
            </Text>
            <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <SettingRow
                icon={<Bell width={18} height={18} color="#14B8A6" />}
                iconBg="#F0FDFA"
                label="Medication Reminders"
                rightElement={
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    trackColor={{false: '#E5E7EB', true: '#14B8A6'}}
                    thumbColor="#ffffff"
                  />
                }
              />
              <Divider />
              <SettingRow
                icon={<Bell width={18} height={18} color="#F97316" />}
                iconBg="#FFF7ED"
                label="Low Stock Alerts"
                rightElement={
                  <Switch
                    value={lowStockEnabled}
                    onValueChange={setLowStockEnabled}
                    trackColor={{false: '#E5E7EB', true: '#14B8A6'}}
                    thumbColor="#ffffff"
                  />
                }
              />
            </View>
          </View>

          {/* Account */}
          <View>
            <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 ml-1">
              Account
            </Text>
            <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <SettingRow
                icon={<Heart width={18} height={18} color="#3B82F6" />}
                iconBg="#EFF6FF"
                label="Personal Information"
                onPress={() => {}}
              />
              <Divider />
              <SettingRow
                icon={<QR width={18} height={18} color="#8B5CF6" />}
                iconBg="#F5F3FF"
                label="My Invite Code"
                onPress={() => {}}
              />
              {user && (
                <>
                  <Divider />
                  <TouchableOpacity
                    onPress={signOut}
                    className="flex-row items-center gap-3 px-4 py-3.5">
                    <View className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
                      <Text className="text-red-400 text-base">↩</Text>
                    </View>
                    <Text className="flex-1 text-red-400 text-sm font-medium">Log Out</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

        </View>
      </ScrollView>
      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
        <EditProfileModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          // Refresh avatar after edit
          const updated = user?.user_metadata?.avatar_url;
          if (updated) setAvatarUrl(updated);
        }}
        currentName={
          user?.user_metadata?.full_name ??
          user?.user_metadata?.given_name ?? ''
        }
        currentAvatarUrl={avatarUrl}
      />
    </SafeAreaView>
  );
}
