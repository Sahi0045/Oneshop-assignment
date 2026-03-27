'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function DisputesPage() {
  const queryClient = useQueryClient();
  const [selectedDispute, setSelectedDispute] = useState<any>(null);

  const { data: disputes, isLoading } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const { data } = await api.get('/admin/disputes');
      return data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ disputeId, resolution, refundAmount }: any) => {
      await api.post(`/admin/disputes/${disputeId}/resolve`, {
        resolution,
        refundAmount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      setSelectedDispute(null);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'RESOLVED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dispute Management</h1>
        <p className="text-gray-600 mt-1">Review and resolve project disputes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Disputes</h2>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {disputes?.map((dispute: any) => (
                  <div
                    key={dispute.id}
                    onClick={() => setSelectedDispute(dispute)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedDispute?.id === dispute.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(dispute.status)}
                          <h3 className="font-medium text-gray-900">{dispute.project?.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{dispute.reason}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>Filed by: {dispute.filedBy?.firstName} {dispute.filedBy?.lastName}</span>
                          <span>•</span>
                          <span>{new Date(dispute.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        dispute.status === 'OPEN'
                          ? 'bg-yellow-100 text-yellow-800'
                          : dispute.status === 'RESOLVED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {dispute.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dispute Details</h2>
          {selectedDispute ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Project</label>
                <p className="text-sm text-gray-900 mt-1">{selectedDispute.project?.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Filed By</label>
                <p className="text-sm text-gray-900 mt-1">
                  {selectedDispute.filedBy?.firstName} {selectedDispute.filedBy?.lastName}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Reason</label>
                <p className="text-sm text-gray-900 mt-1">{selectedDispute.reason}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <p className="text-sm text-gray-900 mt-1">{selectedDispute.description}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Evidence</label>
                {selectedDispute.evidence?.map((file: string, idx: number) => (
                  <a
                    key={idx}
                    href={file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:underline mt-1"
                  >
                    Evidence {idx + 1}
                  </a>
                ))}
              </div>

              {selectedDispute.status === 'OPEN' && (
                <div className="space-y-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      const refundAmount = prompt('Enter refund amount (0 for no refund):');
                      if (refundAmount !== null) {
                        resolveMutation.mutate({
                          disputeId: selectedDispute.id,
                          resolution: 'REFUND_CLIENT',
                          refundAmount: parseFloat(refundAmount),
                        });
                      }
                    }}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Refund Client
                  </button>
                  <button
                    onClick={() => {
                      resolveMutation.mutate({
                        disputeId: selectedDispute.id,
                        resolution: 'RELEASE_TO_FREELANCER',
                        refundAmount: 0,
                      });
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Release to Freelancer
                  </button>
                  <button
                    onClick={() => {
                      const refundAmount = prompt('Enter partial refund amount:');
                      if (refundAmount !== null) {
                        resolveMutation.mutate({
                          disputeId: selectedDispute.id,
                          resolution: 'PARTIAL_REFUND',
                          refundAmount: parseFloat(refundAmount),
                        });
                      }
                    }}
                    className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    Partial Refund
                  </button>
                  <button
                    onClick={() => {
                      resolveMutation.mutate({
                        disputeId: selectedDispute.id,
                        resolution: 'REJECT',
                        refundAmount: 0,
                      });
                    }}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Reject Dispute
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select a dispute to view details</p>
          )}
        </div>
      </div>
    </div>
  );
}
