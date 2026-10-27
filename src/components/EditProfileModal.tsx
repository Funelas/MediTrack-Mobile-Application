import React, {useRef, useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, Animated, PanResponder,
  ActivityIndicator, Image,
} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useAuth} from '../context/AuthContext';
import {uploadAvatar} from '../services/avatarService';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentName: string;
  currentAvatarUrl: string | null;
}

export default function EditProfileModal({visible, onClose, currentName, currentAvatarUrl}: Props) {
  const {user, updateProfile} = useAuth();
  const [name, setName] = useState(currentName);
  const [avatarUri, setAvatarUri] = useState<string | null>(null); // local picked image
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dragY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = dragY.interpolate({
    inputRange: [0, 300], outputRange: [0.5, 0], extrapolate: 'clamp',
  });

  const dragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => { if (gs.dy > 0) dragY.setValue(gs.dy); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80) {
        handleClose();
        Animated.timing(dragY, {toValue: 1000, duration: 150, useNativeDriver: true})
          .start(() => dragY.setValue(0));
      } else {
        Animated.spring(dragY, {toValue: 0, useNativeDriver: true}).start();
      }
    },
  })).current;

  const handleClose = () => {
    setAvatarUri(null);
    setError(null);
    onClose();
  };

  const handlePickImage = () => {
    launchImageLibrary({mediaType: 'photo', quality: 0.8}, response => {
      if (response.didCancel || response.errorCode) return;
      const uri = response.assets?.[0]?.uri;
      if (uri) setAvatarUri(uri);
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      let avatarUrl: string | undefined;

      // Upload new avatar if user picked one
      if (avatarUri) {
        avatarUrl = await uploadAvatar(user.id, avatarUri);
      }

      const err = await updateProfile({
        fullName: name.trim(),
        avatarUrl,
      });

      if (err) { setError(err); return; }
      handleClose();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const displayAvatar = avatarUri ?? currentAvatarUrl;
  const initials = name.trim().slice(0, 2).toUpperCase() || '?';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{flex: 1, justifyContent: 'flex-end'}}>

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#000', opacity: overlayOpacity,
          }}
        />
        <TouchableOpacity activeOpacity={1} onPress={handleClose} style={{flex: 1}} />

        <Animated.View style={{
          transform: [{translateY: dragY}],
          backgroundColor: 'white',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          overflow: 'hidden',
        }}>
          <View {...dragPan.panHandlers} style={{alignItems: 'center', paddingTop: 12, paddingBottom: 4}}>
            <View style={{width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB'}} />
          </View>

          <View style={{paddingHorizontal: 24, paddingBottom: 40}}>
            <Text style={{fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 20, marginTop: 8}}>
              Edit Profile
            </Text>

            {/* Avatar picker */}
            <View style={{alignItems: 'center', marginBottom: 24}}>
              <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                {displayAvatar ? (
                  <Image
                    source={{uri: displayAvatar}}
                    style={{width: 88, height: 88, borderRadius: 44, backgroundColor: '#CCFBF1'}}
                  />
                ) : (
                  <View style={{
                    width: 88, height: 88, borderRadius: 44,
                    backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{fontSize: 28, fontWeight: '700', color: '#14B8A6'}}>{initials}</Text>
                  </View>
                )}
                {/* Camera badge */}
                <View style={{
                  position: 'absolute', bottom: 0, right: 0,
                  backgroundColor: '#14B8A6', borderRadius: 12,
                  width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: '#fff',
                }}>
                  <Text style={{color: '#fff', fontSize: 14}}>📷</Text>
                </View>
              </TouchableOpacity>
              <Text style={{fontSize: 12, color: '#9ca3af', marginTop: 8}}>Tap to change photo</Text>
            </View>

            {/* Name */}
            <Text style={{fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4}}>Full Name</Text>
            <TextInput
              value={name}
              onChangeText={v => { setName(v); setError(null); }}
              placeholder="Juan dela Cruz"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              style={{
                borderWidth: 1,
                borderColor: error ? '#f87171' : '#E5E7EB',
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                fontSize: 14, color: '#1f2937',
                marginBottom: error ? 4 : 16,
              }}
            />
            {error && <Text style={{fontSize: 11, color: '#f87171', marginBottom: 16}}>{error}</Text>}

            {/* Save */}
            <TouchableOpacity
              onPress={handleSave} disabled={loading}
              style={{
                backgroundColor: '#14B8A6', borderRadius: 12,
                paddingVertical: 14, alignItems: 'center',
              }}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{color: '#fff', fontWeight: '600', fontSize: 15}}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
