'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/features/shared';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
} from '@/components/ui';
import {
  useDraftsQuery,
  useUpdateDraftMutation,
  useGenerateDraftsMutation,
} from '@/hooks/api/drafts';
import { useAddToQueueMutation } from '@/hooks/api/queue';
import { usePublishMutation } from '@/hooks/api/publish';
import { useXScraper } from '@/hooks/use-x-scraper';
import {
  Check,
  X,
  Clock,
  Send,
  Sparkles,
  FileText,
  Search,
  Loader2,
  StopCircle,
  ExternalLink,
  CheckSquare,
  Square,
} from 'lucide-react';

interface ScrapedPost {
  id: string;
  author: { handle: string; displayName: string };
  content: string;
  timestamp: string;
  url: string;
  metrics: { replies: number; retweets: number; likes: number; views: number };
  hasMedia: boolean;
  mediaType: string;
  hashtags: string[];
  mentions: string[];
  structure: string;
  extractedAt: string;
}

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  draft: 'secondary',
  approved: 'success',
  rejected: 'destructive',
  posted: 'default',
};

export default function CreatePage() {
  const [searchInput, setSearchInput] = useState('');
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('draft');

  const { data: drafts, isLoading: draftsLoading } = useDraftsQuery();
  const updateMutation = useUpdateDraftMutation();
  const generateMutation = useGenerateDraftsMutation();
  const queueMutation = useAddToQueueMutation();
  const publishMutation = usePublishMutation();

  const {
    isExtensionReady,
    scrapingState,
    results,
    isActive,
    startScraping,
    stopScraping,
  } = useXScraper();

  const filteredDrafts = drafts?.filter((d) => d.status === activeTab) ?? [];

  const draftCounts = useMemo(() => ({
    draft: drafts?.filter((d) => d.status === 'draft').length ?? 0,
    approved: drafts?.filter((d) => d.status === 'approved').length ?? 0,
    rejected: drafts?.filter((d) => d.status === 'rejected').length ?? 0,
    posted: drafts?.filter((d) => d.status === 'posted').length ?? 0,
  }), [drafts]);

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSelectedPosts(new Set());
      startScraping(searchInput.trim());
    }
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const selectAllPosts = () => {
    if (selectedPosts.size === results.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(results.map(p => p.id)));
    }
  };

  const handleGenerate = () => {
    const inspirationPosts = results.filter(p => selectedPosts.has(p.id));
    if (inspirationPosts.length === 0) return;

    generateMutation.mutate({
      inspirationPosts: inspirationPosts.map(p => ({
        content: p.content,
        metrics: p.metrics,
        structure: p.structure,
        author: p.author.handle,
      })),
      count: Math.min(inspirationPosts.length * 2, 6),
    });
  };

  const handleApprove = (id: string) => {
    updateMutation.mutate({ id, status: 'approved' });
  };

  const handleReject = (id: string) => {
    updateMutation.mutate({ id, status: 'rejected' });
  };

  const handleSchedule = (draftId: string) => {
    queueMutation.mutate({ draftId });
  };

  const handlePublishNow = (draftId: string) => {
    publishMutation.mutate({ draftId });
  };

  return (
    <>
      <Header
        title="Create"
        description="Scrape viral posts and generate inspired content"
      />

      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search viral posts on X (e.g., AI, startups, productivity...)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
                disabled={isActive}
              />
              {isActive ? (
                <Button onClick={stopScraping} variant="destructive">
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              ) : (
                <Button onClick={handleSearch} disabled={!searchInput.trim()}>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              )}
            </div>
            {isActive && scrapingState && (
              <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-500">
                      {scrapingState.statusText || 'Scraping...'}
                    </p>
                    <p className="text-sm text-neutral-400">
                      {scrapingState.collectedPosts?.length || 0} posts found
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{
                      width: `${Math.round((scrapingState.currentPage / scrapingState.totalPages) * 100)}%`
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">
                    Viral Posts ({results.length})
                  </h3>
                  <Button variant="ghost" size="sm" onClick={selectAllPosts}>
                    {selectedPosts.size === results.length ? (
                      <CheckSquare className="mr-2 h-4 w-4" />
                    ) : (
                      <Square className="mr-2 h-4 w-4" />
                    )}
                    {selectedPosts.size === results.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={selectedPosts.size === 0 || generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate from {selectedPosts.size} post{selectedPosts.size !== 1 ? 's' : ''}
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto">
                {results.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => togglePostSelection(post.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      selectedPosts.has(post.id)
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-400">
                        @{post.author.handle}
                      </span>
                      <div className="flex items-center gap-2">
                        {selectedPosts.has(post.id) ? (
                          <CheckSquare className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Square className="h-4 w-4 text-neutral-600" />
                        )}
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-neutral-500 hover:text-white"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                    <p className="mb-2 text-sm line-clamp-3">{post.content}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {post.metrics.likes.toLocaleString()} ♥
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {post.metrics.retweets.toLocaleString()} ↻
                      </Badge>
                      {post.structure && post.structure !== 'general' && (
                        <Badge variant="outline" className="text-xs">{post.structure}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="draft">
                  Pending ({draftCounts.draft})
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Approved ({draftCounts.approved})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected ({draftCounts.rejected})
                </TabsTrigger>
                <TabsTrigger value="posted">
                  Posted ({draftCounts.posted})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {draftsLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-40 w-full" />
                    ))}
                  </div>
                ) : filteredDrafts.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredDrafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="rounded-lg border border-neutral-800 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <Badge variant={statusColors[draft.status]}>
                            {draft.status}
                          </Badge>
                          <span className="text-xs text-neutral-500">
                            {draft.content.length}/280
                          </span>
                        </div>

                        <p className="mb-4 text-sm leading-relaxed">
                          {draft.content}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {draft.status === 'draft' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprove(draft.id)}
                                disabled={updateMutation.isPending}
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(draft.id)}
                                disabled={updateMutation.isPending}
                              >
                                <X className="mr-1 h-4 w-4" />
                                Reject
                              </Button>
                            </>
                          )}

                          {draft.status === 'approved' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSchedule(draft.id)}
                                disabled={queueMutation.isPending}
                              >
                                <Clock className="mr-1 h-4 w-4" />
                                Schedule
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handlePublishNow(draft.id)}
                                disabled={publishMutation.isPending}
                              >
                                <Send className="mr-1 h-4 w-4" />
                                Post Now
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="mb-4 h-12 w-12 text-neutral-600" />
                    <p className="text-neutral-500">
                      {activeTab === 'draft'
                        ? 'No pending drafts. Search for viral posts and generate content.'
                        : `No ${activeTab} drafts`}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
