'use client';

import { useState, useEffect, useCallback } from 'react';

interface ScrapingState {
  active: boolean;
  searchQuery: string;
  status: string;
  statusText: string;
  currentPage: number;
  totalPages: number;
  collectedPosts: ScrapedPost[];
  postsProcessed: number;
  completed: boolean;
}

interface ScrapedPost {
  id: string;
  author: {
    handle: string;
    displayName: string;
  };
  content: string;
  timestamp: string;
  url: string;
  metrics: {
    replies: number;
    retweets: number;
    likes: number;
    views: number;
  };
  hasMedia: boolean;
  mediaType: string;
  hashtags: string[];
  mentions: string[];
  structure: string;
  extractedAt: string;
}

export function useXScraper() {
  const [isExtensionReady, setIsExtensionReady] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!(window as Window & { __X_SCRAPER_READY__?: boolean }).__X_SCRAPER_READY__;
    }
    return false;
  });
  const [scrapingState, setScrapingState] = useState<ScrapingState | null>(null);
  const [results, setResults] = useState<ScrapedPost[]>([]);

  useEffect(() => {
    const handleReady = () => {
      setIsExtensionReady(true);
    };

    const handleState = (event: CustomEvent) => {
      const { state } = event.detail || {};
      if (state) {
        setScrapingState(state);
        if (state.completed && state.collectedPosts?.length > 0) {
          setResults(state.collectedPosts);
        }
      }
    };

    const handleStarted = (event: CustomEvent) => {
      const { state } = event.detail || {};
      if (state) {
        setScrapingState(state);
      }
    };

    const handleStopped = (event: CustomEvent) => {
      const { posts } = event.detail || {};
      if (posts) {
        setResults(posts);
      }
    };

    const handleError = (event: CustomEvent) => {
      console.warn('X Scraper error:', event.detail?.error);
    };

    window.addEventListener('x-scraper-ready', handleReady as EventListener);
    window.addEventListener('x-scraper-state', handleState as EventListener);
    window.addEventListener('x-scraper-started', handleStarted as EventListener);
    window.addEventListener('x-scraper-stopped', handleStopped as EventListener);
    window.addEventListener('x-scraper-error', handleError as EventListener);

    return () => {
      window.removeEventListener('x-scraper-ready', handleReady as EventListener);
      window.removeEventListener('x-scraper-state', handleState as EventListener);
      window.removeEventListener('x-scraper-started', handleStarted as EventListener);
      window.removeEventListener('x-scraper-stopped', handleStopped as EventListener);
      window.removeEventListener('x-scraper-error', handleError as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!scrapingState?.active || scrapingState?.completed) return;

    const interval = setInterval(() => {
      window.dispatchEvent(new CustomEvent('x-scraper-get-state'));
    }, 1000);

    return () => clearInterval(interval);
  }, [scrapingState?.active, scrapingState?.completed]);

  const startScraping = useCallback((searchQuery: string) => {
    console.log('useXScraper: Dispatching x-scraper-start event with query:', searchQuery);
    setResults([]);
    setScrapingState(null);

    const event = new CustomEvent('x-scraper-start', {
      detail: { searchQuery }
    });
    window.dispatchEvent(event);
  }, []);

  const stopScraping = useCallback(() => {
    window.dispatchEvent(new CustomEvent('x-scraper-stop'));
  }, []);

  const getState = useCallback(() => {
    window.dispatchEvent(new CustomEvent('x-scraper-get-state'));
  }, []);

  return {
    isExtensionReady,
    scrapingState,
    results,
    isActive: scrapingState?.active && !scrapingState?.completed,
    startScraping,
    stopScraping,
    getState
  };
}
