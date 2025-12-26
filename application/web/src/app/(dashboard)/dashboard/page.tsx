'use client';

import { Header } from '@/components/features/shared';
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '@/components/ui';
import { useQueueQuery } from '@/hooks/api/queue';
import { useDraftsQuery } from '@/hooks/api/drafts';
import { usePostedQuery } from '@/hooks/api/publish';
import {
  Sparkles,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: queueData, isLoading: queueLoading } = useQueueQuery();
  const { data: drafts, isLoading: draftsLoading } = useDraftsQuery();
  const { data: posted, isLoading: postedLoading } = usePostedQuery();

  const stats = queueData?.stats;
  const pendingDrafts = drafts?.filter((d) => d.status === 'draft').length ?? 0;
  const approvedDrafts = drafts?.filter((d) => d.status === 'approved').length ?? 0;
  const totalDrafts = drafts?.length ?? 0;

  return (
    <>
      <Header
        title="Dashboard"
        description="Overview of your content engine performance"
      />

      <div className="p-6">
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Drafts</CardTitle>
              <Sparkles className="h-4 w-4 text-neutral-500" />
            </CardHeader>
            <CardContent>
              {draftsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{totalDrafts}</div>
              )}
              <p className="text-xs text-neutral-500">Generated content</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Draft Posts</CardTitle>
              <FileText className="h-4 w-4 text-neutral-500" />
            </CardHeader>
            <CardContent>
              {draftsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{pendingDrafts}</div>
              )}
              <p className="text-xs text-neutral-500">
                {approvedDrafts} approved, ready to schedule
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Queue</CardTitle>
              <Clock className="h-4 w-4 text-neutral-500" />
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.pending ?? 0}</div>
              )}
              <p className="text-xs text-neutral-500">Pending posts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Posted Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-neutral-500" />
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {stats?.totalPostedToday ?? 0}
                </div>
              )}
              <p className="text-xs text-neutral-500">
                {stats?.rateLimits?.remainingIn24h ?? 0} remaining today
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>15 min limit</span>
                      <span>
                        {stats?.rateLimits?.tweetsIn15min ?? 0} / 5
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{
                          width: `${((stats?.rateLimits?.tweetsIn15min ?? 0) / 5) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>24h limit</span>
                      <span>
                        {stats?.rateLimits?.tweetsIn24h ?? 0} / 50
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{
                          width: `${((stats?.rateLimits?.tweetsIn24h ?? 0) / 50) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="pt-2">
                    <Badge
                      variant={stats?.rateLimits?.canPost ? 'success' : 'destructive'}
                    >
                      {stats?.rateLimits?.canPost ? 'Can Post' : 'Rate Limited'}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Posts</CardTitle>
            </CardHeader>
            <CardContent>
              {postedLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : posted && posted.length > 0 ? (
                <div className="space-y-3">
                  {posted.slice(0, 5).map((tweet) => (
                    <div
                      key={tweet.id}
                      className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                    >
                      <p className="line-clamp-2 text-sm">{tweet.content}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {new Date(tweet.postedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="mb-2 h-8 w-8 text-neutral-400" />
                  <p className="text-sm text-neutral-500">No posts yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
