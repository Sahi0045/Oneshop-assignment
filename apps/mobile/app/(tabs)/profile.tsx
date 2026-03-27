import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-6 border-b border-gray-100">
        <View className="w-16 h-16 rounded-full bg-blue-600 items-center justify-center mb-3">
          <Text className="text-white text-2xl font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Text>
        </View>
        <Text className="text-xl font-bold text-gray-900">
          {user?.firstName} {user?.lastName}
        </Text>
        <Text className="text-gray-500">{user?.email}</Text>
        <View className="mt-2 bg-blue-100 self-start px-3 py-1 rounded-full">
          <Text className="text-blue-700 text-sm font-medium capitalize">
            {user?.role?.toLowerCase()}
          </Text>
        </View>
      </View>

      <View className="px-6 py-6">
        <TouchableOpacity
          className="bg-red-50 border border-red-200 rounded-xl py-4 items-center"
          onPress={handleLogout}
        >
          <Text className="text-red-600 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
