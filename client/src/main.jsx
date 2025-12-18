import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// [新增] 引入 Provider
import { GameProvider } from './context/GameContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* [修改] 用 GameProvider 包裹 App */}
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
)