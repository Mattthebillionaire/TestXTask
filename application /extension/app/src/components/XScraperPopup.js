import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import SearchIcon from '@mui/icons-material/Search'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'

const STATUS_CONFIG = {
  opening_explore: {
    icon: OpenInNewIcon,
    color: '#1d9bf0',
    text: 'Opening X Explore page...'
  },
  typing_search: {
    icon: KeyboardIcon,
    color: '#ffad1f',
    text: 'Typing search query...'
  },
  submitting_search: {
    icon: SearchIcon,
    color: '#1d9bf0',
    text: 'Submitting search...'
  },
  extracting: {
    icon: AutorenewIcon,
    color: '#00ba7c',
    text: 'Extracting posts...'
  }
}

function XScraperPopup() {
  const [scrapingState, setScrapingState] = useState(null)

  useEffect(() => {
    checkScrapingState()
    const interval = setInterval(checkScrapingState, 1000)
    return () => clearInterval(interval)
  }, [])

  const checkScrapingState = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getScrapingState' })
      if (response?.success) {
        setScrapingState(response.state)
      }
    } catch (error) {
      console.error('Error checking state:', error)
    }
  }

  const isActive = scrapingState?.active && !scrapingState?.completed
  const currentStatus = scrapingState?.status || 'opening_explore'
  const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.opening_explore
  const StatusIcon = statusConfig.icon

  const progress = scrapingState?.currentPage && scrapingState?.totalPages
    ? Math.round((scrapingState.currentPage / scrapingState.totalPages) * 100)
    : 0

  if (isActive) {
    return (
      <Box sx={{ p: 2, bgcolor: '#000' }}>
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%)',
            borderRadius: 2,
            p: 2,
            mb: 2,
            textAlign: 'center'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
            X Content Scraper
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Scraping in progress...
          </Typography>
        </Box>

        <Paper sx={{ p: 2, mb: 2, bgcolor: '#16181c', border: '1px solid #2f3336' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: `${statusConfig.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <StatusIcon sx={{ color: statusConfig.color, fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ color: '#e7e9ea', fontWeight: 600 }}>
                {scrapingState?.statusText || statusConfig.text}
              </Typography>
              <Typography variant="caption" sx={{ color: '#71767b' }}>
                "{scrapingState?.searchQuery}"
              </Typography>
            </Box>
            <CircularProgress size={24} sx={{ color: statusConfig.color }} />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#71767b' }}>
                Progress
              </Typography>
              <Typography variant="caption" sx={{ color: '#71767b' }}>
                {scrapingState?.currentPage || 0} / {scrapingState?.totalPages || 5}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: '#2f3336',
                '& .MuiLinearProgress-bar': {
                  bgcolor: statusConfig.color,
                  borderRadius: 3
                }
              }}
            />
          </Box>

          <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#000', borderRadius: 1 }}>
            <Typography variant="h4" sx={{ color: '#e7e9ea', fontWeight: 700 }}>
              {scrapingState?.collectedPosts?.length || 0}
            </Typography>
            <Typography variant="caption" sx={{ color: '#71767b' }}>
              Posts Found
            </Typography>
          </Box>
        </Paper>

        <Typography variant="caption" sx={{ color: '#71767b', display: 'block', textAlign: 'center' }}>
          Results will appear in your web app
        </Typography>
      </Box>
    )
  }

  if (scrapingState?.completed && scrapingState?.collectedPosts?.length > 0) {
    return (
      <Box sx={{ p: 2, bgcolor: '#000' }}>
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%)',
            borderRadius: 2,
            p: 2,
            mb: 2,
            textAlign: 'center'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
            X Content Scraper
          </Typography>
        </Box>

        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(0, 186, 124, 0.1)', border: '1px solid rgba(0, 186, 124, 0.3)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CheckCircleIcon sx={{ color: '#00ba7c' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e7e9ea' }}>
              Scraping Complete!
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#71767b' }}>
            Found {scrapingState.collectedPosts.length} posts for "{scrapingState.searchQuery}"
          </Typography>
        </Paper>

        <Typography variant="caption" sx={{ color: '#71767b', display: 'block', textAlign: 'center' }}>
          Results are available in your web app
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2, bgcolor: '#000' }}>
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%)',
          borderRadius: 2,
          p: 2,
          mb: 2,
          textAlign: 'center'
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
          X Content Scraper
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
          Extension for Content Engine
        </Typography>
      </Box>

      <Paper sx={{ p: 3, bgcolor: '#16181c', border: '1px solid #2f3336', textAlign: 'center' }}>
        <HourglassEmptyIcon sx={{ fontSize: 48, color: '#71767b', mb: 2 }} />
        <Typography variant="subtitle1" sx={{ color: '#e7e9ea', fontWeight: 600, mb: 1 }}>
          Waiting for Search
        </Typography>
        <Typography variant="body2" sx={{ color: '#71767b', mb: 2 }}>
          Go to your Content Engine dashboard and search for a keyword to start scraping viral posts.
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mt: 2, bgcolor: '#16181c', border: '1px solid #2f3336' }}>
        <Typography variant="caption" sx={{ color: '#71767b', display: 'block', mb: 1 }}>
          How it works:
        </Typography>
        <Box component="ol" sx={{ m: 0, pl: 2.5, color: '#71767b', fontSize: 12 }}>
          <li style={{ marginBottom: 4 }}>Search from your web app</li>
          <li style={{ marginBottom: 4 }}>Extension opens X automatically</li>
          <li style={{ marginBottom: 4 }}>Posts are scraped and returned</li>
          <li>Results appear in your dashboard</li>
        </Box>
      </Paper>
    </Box>
  )
}

export default XScraperPopup
