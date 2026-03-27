import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/auth.store';

const registerSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
  role: z.enum(['CLIENT', 'FREELANCER']),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'FREELANCER' },
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      const res = await api.post('/auth/register', data);
      const { user, accessToken, refreshToken } = res.data.data;
      await setAuth(user, accessToken, refreshToken);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Registration failed', 'Please try again');
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 py-12">
      <Text className="text-3xl font-bold text-gray-900 mb-2">Create account</Text>
      <Text className="text-gray-500 mb-8">Join the freelancer platform</Text>

      {(['firstName', 'lastName', 'email', 'password'] as const).map((field) => (
        <Controller
          key={field}
          control={control}
          name={field}
          render={({ field: { onChange, value } }) => (
            <>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 mb-1 text-gray-900 mt-3"
                placeholder={field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                secureTextEntry={field === 'password'}
                autoCapitalize={field === 'email' || field === 'password' ? 'none' : 'words'}
                keyboardType={field === 'email' ? 'email-address' : 'default'}
                onChangeText={onChange}
                value={value}
              />
              {errors[field] && (
                <Text className="text-red-500 text-sm">{errors[field]?.message}</Text>
              )}
            </>
          )}
        />
      ))}

      <TouchableOpacity
        className="bg-blue-600 rounded-lg py-4 mt-6"
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      >
        <Text className="text-white text-center font-semibold text-base">
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity className="mt-4" onPress={() => router.back()}>
        <Text className="text-center text-gray-600">
          Already have an account? <Text className="text-blue-600 font-semibold">Sign in</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
