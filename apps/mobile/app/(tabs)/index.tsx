import { View, Text, ScrollView } from 'react-native';
import { useAuthStore } from '../../src/store/auth.store';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-blue-600 px-6 pt-14 pb-8">
        <Text className="text-white text-lg">Welcome back,</Text>
        <Text className="text-white text-2xl font-bold">{user?.firstName ?? 'User'}</Text>
      </View>

      <View className="px-6 py-6 gap-4">
        <View className="bg-white rounded-xl p-5 shadow-sm">
          <Text className="text-gray-500 text-sm">Active Projects</Text>
          <Text className="text-3xl font-bold text-gray-900 mt-1">0</Text>
        </View>
        <View className="bg-white rounded-xl p-5 shadow-sm">
          <Text className="text-gray-500 text-sm">Pending Bids</Text>
          <Text className="text-3xl font-bold text-gray-900 mt-1">0</Text>
        </View>
        <View className="bg-white rounded-xl p-5 shadow-sm">
          <Text className="text-gray-500 text-sm">Unread Messages</Text>
          <Text className="text-3xl font-bold text-gray-900 mt-1">0</Text>
        </View>
      </View>
    </ScrollView>
  );
}
