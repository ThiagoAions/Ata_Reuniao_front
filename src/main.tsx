import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import DragAndDropCalibrator from './components/DragAndDropCalibrator.tsx'
import CadastroBiometria from './components/CadastroBiometria.tsx'

// Access the calibrator tool at: http://localhost:3001/?calibrator
const isCalibrator = window.location.search.includes('calibrator');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCalibrator ? (
      <DragAndDropCalibrator />
    ) : (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/cadastro-biometria" element={<CadastroBiometria />} />
        </Routes>
      </BrowserRouter>
    )}
  </StrictMode>,
)
