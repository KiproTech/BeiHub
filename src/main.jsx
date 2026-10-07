import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.jsx'
import SetupRequired from './components/SetupRequired.jsx'
import { CONFIG_PROBLEM } from './lib/config.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>{CONFIG_PROBLEM ? <SetupRequired /> : <App />}</StrictMode>,
)
