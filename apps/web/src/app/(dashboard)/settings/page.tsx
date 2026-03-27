'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Bell, CreditCard, Shield, Save } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const profileSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  bio: z.string().max(500).optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  hourlyRate: z.number().positive().optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Required'),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

function ProfileTab() {
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      bio: user?.bio ?? '',
      country: user?.country ?? '',
      city: user?.city ?? '',
      timezone: user?.timezone ?? '',
      hourlyRate: user?.hourlyRate ?? '',
    },
  });

  const onSubmit = async (data: ProfileForm) => {
    try {
      await api.patch('/users/me', data);
      toast.success({ title: 'Profile updated' });
    } catch {
      toast.error({ title: 'Failed to update profile' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(['firstName', 'lastName'] as const).map(field => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={field}>{field === 'firstName' ? 'First Name' : 'Last Name'} <span className="text-destructive">*</span></Label>
            <Input id={field} {...register(field)} className={cn(errors[field] && 'border-destructive')} />
            {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" rows={4} maxLength={500} showCount {...register('bio')} placeholder="Tell clients about yourself..." />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" {...register('country')} placeholder="e.g. United States" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" {...register('city')} placeholder="e.g. New York" />
        </div>
      </div>
      {user?.role === 'FREELANCER' && (
        <div className="space-y-1.5">
          <Label htmlFor="hourlyRate">Hourly Rate (USD)</Label>
          <Input id="hourlyRate" type="number" min="1" step="0.01" {...register('hourlyRate', { valueAsNumber: true })} placeholder="e.g. 75" />
        </div>
      )}
      <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="gap-1.5">
        <Save className="h-4 w-4" /> Save Changes
      </Button>
    </form>
  );
}

function SecurityTab() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordForm) => {
    try {
      await api.post('/auth/change-password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success({ title: 'Password changed successfully' });
      reset();
    } catch {
      toast.error({ title: 'Failed to change password', description: 'Check your current password and try again.' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-md">
      {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map(field => (
        <div key={field} className="space-y-1.5">
          <Label htmlFor={field}>
            {field === 'currentPassword' ? 'Current Password' : field === 'newPassword' ? 'New Password' : 'Confirm New Password'}
          </Label>
          <Input id={field} type="password" {...register(field)} className={cn(errors[field] && 'border-destructive')} />
          {errors[field] && <p className="text-xs text-destructive">{errors[field]?.message}</p>}
        </div>
      ))}
      <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="gap-1.5">
        <Lock className="h-4 w-4" /> Update Password
      </Button>
    </form>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    emailBids: true, emailContracts: true, emailMessages: true,
    emailPayments: true, pushBids: false, pushMessages: true,
  });

  const toggle = (key: keyof typeof prefs) => setPrefs(p => ({ ...p, [key]: !p[key] }));

  const items = [
    { key: 'emailBids', label: 'New bids on your projects', channel: 'Email' },
    { key: 'emailContracts', label: 'Contract updates', channel: 'Email' },
    { key: 'emailMessages', label: 'New messages', channel: 'Email' },
    { key: 'emailPayments', label: 'Payment notifications', channel: 'Email' },
    { key: 'pushBids', label: 'New bids (push)', channel: 'Push' },
    { key: 'pushMessages', label: 'New messages (push)', channel: 'Push' },
  ] as const;

  return (
    <div className="space-y-4 max-w-lg">
      {items.map(({ key, label, channel }) => (
        <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{channel}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[key]}
            onClick={() => toggle(key)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              prefs[key] ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span className={cn('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform', prefs[key] ? 'translate-x-5' : 'translate-x-0')} />
          </button>
        </div>
      ))}
      <Button className="gap-1.5 mt-2" onClick={() => toast.success({ title: 'Notification preferences saved' })}>
        <Save className="h-4 w-4" /> Save Preferences
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account preferences and security.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList variant="underline" className="w-full justify-start">
          <TabsTrigger value="profile" className="gap-1.5"><User className="h-4 w-4" />Profile</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Lock className="h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card><CardHeader className="pb-4"><CardTitle className="text-base">Profile Information</CardTitle><CardDescription>Update your public profile details.</CardDescription></CardHeader>
            <CardContent><ProfileTab /></CardContent></Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card><CardHeader className="pb-4"><CardTitle className="text-base">Password & Security</CardTitle><CardDescription>Keep your account secure.</CardDescription></CardHeader>
            <CardContent><SecurityTab /></CardContent></Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card><CardHeader className="pb-4"><CardTitle className="text-base">Notification Preferences</CardTitle><CardDescription>Choose what you want to be notified about.</CardDescription></CardHeader>
            <CardContent><NotificationsTab /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
