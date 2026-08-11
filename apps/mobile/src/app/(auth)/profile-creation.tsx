import { useState } from 'react';
import { View, TextInput, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

const YEARS = ['1st year', '2nd year', '3rd year', '4th year', 'Other'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function ProfileCreationScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [fullName, setFullName] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuthError = useAuthStore((state) => state.setError);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleCreateProfile = async () => {
    if (!fullName.trim() || !yearOfStudy || !gender || !phone.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (!user) {
        setError('User not authenticated');
        return;
      }

      const currentUser = user;

      // Update profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          year_of_study: parseInt(yearOfStudy.split('')[0]),
          gender: gender.toLowerCase(),
          phone: phone.trim(),
        })
        .eq('id', currentUser.id);

      if (profileError) {
        setError(profileError.message);
        setAuthError(profileError.message);
        return;
      }

      // Upload photo if selected
      if (photoUri) {
        const fileName = `${currentUser.id}/profile.jpg`;

        // Fetch photo as blob for React Native compatibility
        const response = await fetch(photoUri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, blob, { contentType: 'image/jpeg' });

        if (uploadError && !uploadError.message.includes('already exists')) {
          setError('Failed to upload photo');
          return;
        }

        // Update photo_url in profile
        const photoUrl = supabase.storage
          .from('profile-photos')
          .getPublicUrl(fileName).data.publicUrl;

        await supabase
          .from('profiles')
          .update({ photo_url: photoUrl })
          .eq('id', currentUser.id);
      }

      // Navigate to home
      router.replace('/(home)');
    } catch (err: any) {
      setError(err.message || 'Failed to create profile');
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        <ThemedText type="title" className="mb-6 text-xl">
          A few details before we begin
        </ThemedText>

        {/* Full Name */}
        <View className="mb-4 gap-2">
          <ThemedText type="default" className="font-semibold">
            First name
          </ThemedText>
          <TextInput
            placeholder="Your name"
            placeholderTextColor="#999"
            value={fullName}
            onChangeText={setFullName}
            editable={!isLoading}
            style={{ color: '#000', backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, fontSize: 16 }}
          />
        </View>

        {/* Year of Study */}
        <View className="mb-4 gap-2">
          <ThemedText type="default" className="font-semibold">
            Year of study
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
            {YEARS.map((year) => (
              <Pressable
                key={year}
                onPress={() => setYearOfStudy(year)}
                className={`rounded-lg px-4 py-2 ${
                  yearOfStudy === year
                    ? 'bg-white'
                    : 'border border-gray-300 dark:border-gray-600'
                }`}
              >
                <ThemedText
                  className={yearOfStudy === year ? 'font-semibold text-black' : ''}
                >
                  {year}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Gender */}
        <View className="mb-4 gap-2">
          <ThemedText type="default" className="font-semibold">
            Gender
          </ThemedText>
          <View className="gap-2">
            {GENDERS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                className={`rounded-lg px-4 py-2 ${
                  gender === g ? 'bg-white' : 'border border-gray-300 dark:border-gray-600'
                }`}
              >
                <ThemedText className={gender === g ? 'font-semibold text-black' : ''}>
                  ○ {g}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Phone for Founder Contact */}
        <View className="mb-4 gap-2">
          <ThemedText type="default" className="font-semibold">
            WhatsApp number (for event updates)
          </ThemedText>
          <TextInput
            placeholder="+91 9XXXXXXXXX"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
            editable={!isLoading}
            keyboardType="phone-pad"
            style={{ color: '#000', backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, fontSize: 16 }}
          />
          <ThemedText type="default" themeColor="textSecondary" className="text-xs">
            We'll use this to contact you about event details and changes
          </ThemedText>
        </View>

        {/* Photo Upload */}
        <View className="mb-6 gap-2">
          <ThemedText type="default" className="font-semibold">
            Add a photo
          </ThemedText>
          <Pressable
            onPress={handlePickImage}
            disabled={isLoading}
            className="rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 dark:border-gray-600"
          >
            <ThemedText className="text-center font-semibold">
              {photoUri ? 'Photo selected ✓' : 'Upload'}
            </ThemedText>
          </Pressable>
          <ThemedText type="default" themeColor="textSecondary" className="text-xs">
            This photo is seen only by our team, to help us craft the right group for you —
            never by other members.
          </ThemedText>
        </View>

        {error && (
          <ThemedText type="default" themeColor="textSecondary" className="mb-4 text-red-500">
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={handleCreateProfile}
          disabled={isLoading || !fullName.trim() || !yearOfStudy || !gender || !phone.trim()}
          className="rounded-lg bg-white py-3 px-4 disabled:opacity-50"
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <ThemedText className="text-center font-semibold text-black">
              Continue →
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}
