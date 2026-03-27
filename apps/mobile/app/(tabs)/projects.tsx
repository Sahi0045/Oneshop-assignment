import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

interface Project {
  id: string;
  title: string;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  bidCount: number;
  status: string;
}

export default function ProjectsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data.data),
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
        <Text className="text-2xl font-bold text-gray-900">Projects</Text>
      </View>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item: Project) => item.id}
        contentContainerClassName="px-4 py-4 gap-3"
        renderItem={({ item }: { item: Project }) => (
          <TouchableOpacity className="bg-white rounded-xl p-4 shadow-sm">
            <Text className="font-semibold text-gray-900 text-base">{item.title}</Text>
            <Text className="text-gray-500 text-sm mt-1">
              {item.currency} {item.budgetMin} – {item.budgetMax}
            </Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-blue-600 text-sm">{item.bidCount} bids</Text>
              <Text className="text-gray-400 text-sm capitalize">{item.status.toLowerCase()}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-gray-400 text-base">No projects found</Text>
          </View>
        }
      />
    </View>
  );
}
