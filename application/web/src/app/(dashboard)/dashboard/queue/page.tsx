'use client';

import { Header } from '@/components/features/shared';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import { useQueueQuery } from '@/hooks/api/queue';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning'; icon: React.ElementType }
> = {
  pending: { label: 'Pending', variant: 'secondary', icon: Clock },
  posting: { label: 'Posting', variant: 'warning', icon: Loader2 },
  posted: { label: 'Posted', variant: 'success', icon: CheckCircle },
  failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
};

export default function QueuePage() {
  const [activeTab, setActiveTab] = useState('pending');
  const { data, isLoading } = useQueueQuery();

  const queue = data?.queue ?? [];
  const stats = data?.stats;

  const filteredQueue = queue.filter((item) => item.status === activeTab);

  return (
    <>
      <Header
        title="Queue"
        description="Manage scheduled posts and view queue status"
      />

      <div className="p-6">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pending ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Posting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.posting ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Posted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.posted ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.failed ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="pending">
              Pending ({queue.filter((q) => q.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="posting">
              Posting ({queue.filter((q) => q.status === 'posting').length})
            </TabsTrigger>
            <TabsTrigger value="posted">
              Posted ({queue.filter((q) => q.status === 'posted').length})
            </TabsTrigger>
            <TabsTrigger value="failed">
              Failed ({queue.filter((q) => q.status === 'failed').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredQueue.length > 0 ? (
              <div className="space-y-3">
                {filteredQueue.map((item) => {
                  const config = statusConfig[item.status];
                  const Icon = config.icon;

                  return (
                    <Card key={item.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full ${
                              item.status === 'posting'
                                ? 'animate-pulse bg-yellow-100 text-yellow-600'
                                : item.status === 'posted'
                                ? 'bg-green-100 text-green-600'
                                : item.status === 'failed'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            <Icon
                              className={`h-5 w-5 ${
                                item.status === 'posting' ? 'animate-spin' : ''
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-medium">
                              Draft: {item.draftId.slice(0, 16)}...
                            </p>
                            <p className="text-sm text-neutral-500">
                              Scheduled:{' '}
                              {new Date(item.scheduledAt).toLocaleString()}
                            </p>
                            {item.lastError && (
                              <p className="mt-1 text-sm text-red-500">
                                Error: {item.lastError}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.retryCount > 0 && (
                            <span className="text-sm text-neutral-500">
                              Retries: {item.retryCount}
                            </span>
                          )}
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="mb-4 h-12 w-12 text-neutral-300" />
                <p className="text-neutral-500">No {activeTab} items in queue</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
