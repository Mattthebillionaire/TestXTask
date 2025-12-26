'use client';

import { Header } from '@/components/features/shared';
import {
  Card,
  CardContent,
  Badge,
  Skeleton,
} from '@/components/ui';
import { usePostedQuery } from '@/hooks/api/publish';
import { ExternalLink, Heart, Repeat2, MessageCircle, History } from 'lucide-react';

export default function HistoryPage() {
  const { data: posted, isLoading } = usePostedQuery();

  return (
    <>
      <Header
        title="History"
        description="View all published posts and their engagement"
      />

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : posted && posted.length > 0 ? (
          <div className="space-y-4">
            {posted.map((tweet) => (
              <Card key={tweet.id}>
                <CardContent className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap text-base leading-relaxed">
                        {tweet.content}
                      </p>
                    </div>
                    <a
                      href={`https://twitter.com/i/web/status/${tweet.tweetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 flex-shrink-0 text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-white"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm text-neutral-500">
                      {new Date(tweet.postedAt).toLocaleString()}
                    </span>

                    {tweet.engagement24h && (
                      <div className="flex gap-3">
                        <Badge variant="secondary" className="gap-1">
                          <Heart className="h-3 w-3" />
                          {tweet.engagement24h.likes.toLocaleString()}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <Repeat2 className="h-3 w-3" />
                          {tweet.engagement24h.retweets.toLocaleString()}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {tweet.engagement24h.replies.toLocaleString()}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History className="mb-4 h-12 w-12 text-neutral-300" />
            <p className="text-lg font-medium text-neutral-600">No posts yet</p>
            <p className="text-neutral-500">
              Posts will appear here after publishing
            </p>
          </div>
        )}
      </div>
    </>
  );
}
