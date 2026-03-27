'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Users, Briefcase, DollarSign, AlertCircle, TrendingUp, Activity } from 'lucide-react';

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await api.get('/admin/stats');
      return data.data;
    },
  });

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      change: '+12%',
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Active Projects',
      value: stats?.activeProjects || 0,
      change: '+8%',
      icon: Briefcase,
      color: 'bg-green-500',
    },
    {
      title: 'GMV (This Month)',
      value: `$${(stats?.gmv || 0).toLocaleString()}`,
      change: '+23%',
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      title: 'Open Disputes',
      value: stats?.openDisputes || 0,
      change: '-5%',
      icon: AlertCircle,
      color: 'bg-red-500',
    },
    {
      title: 'Platform Revenue',
      value: `$${(stats?.platformRevenue || 0).toLocaleString()}`,
      change: '+18%',
      icon: TrendingUp,
      color: 'bg-indigo-500',
    },
    {
      title: 'Active Bids',
      value: stats?.activeBids || 0,
      change: '+15%',
      icon: Activity,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Platform overview and key metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <p className="text-sm text-green-600 mt-1">{stat.change} from last month</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {stats?.recentActivity?.map((activity: any, idx: number) => (
              <div key={idx} className="flex items-start space-x-3 pb-4 border-b last:border-0">
                <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                </div>
              </div>
            )) || (
              <p className="text-sm text-gray-500">No recent activity</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Freelancers</h2>
          <div className="space-y-4">
            {stats?.topFreelancers?.map((freelancer: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between pb-4 border-b last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium">{freelancer.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{freelancer.name}</p>
                    <p className="text-xs text-gray-500">{freelancer.completedProjects} projects</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">${freelancer.earnings}</p>
                  <p className="text-xs text-gray-500">⭐ {freelancer.rating}</p>
                </div>
              </div>
            )) || (
              <p className="text-sm text-gray-500">No data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
