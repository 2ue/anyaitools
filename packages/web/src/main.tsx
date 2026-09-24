import React from 'react'
import ReactDOM from 'react-dom/client'
import './api'
import App from '../../desktop/src/renderer/App'
import '../../desktop/src/renderer/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
