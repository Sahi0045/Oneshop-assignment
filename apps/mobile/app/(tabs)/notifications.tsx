import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

interface Notification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data.data),
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Notifications</Text>
      </View>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item: Notification) => item.id}
        contentContainerClassName="px-4 py-4 gap-2"
        renderItem={({ item }: { item: Notification }) => (
          <View className={`bg-white rounded-xl p-4 shadow-sm ${!item.isRead ? 'border-l-4 border-blue-500' : ''}`}>
            <Text className="font-semibold text-gray-900">{item.title}</Text>
            <Text className="text-gray-500 text-sm mt-1">{item.body}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-gray-400 text-base">No notifications</Text>
          </View>
        }
      />
    </View>
  );
}
