import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if (window.location.pathname !== '/') {
  const savedTheme = window.localStorage.getItem('sc-theme')
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  document.documentElement.setAttribute(
    'data-theme',
    savedTheme === 'dark' || (!savedTheme && prefersDark) ? 'dark' : 'light',
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
