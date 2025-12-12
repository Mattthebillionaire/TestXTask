import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import XScraperPopup from './components/XScraperPopup'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1d9bf0'
    },
    background: {
      default: '#000000',
      paper: '#16181c'
    }
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }
})

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div style={{ width: 380, minHeight: 320 }}>
        <XScraperPopup />
      </div>
    </ThemeProvider>
  )
}

export default App
