import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DragAndDropCalibrator from './components/DragAndDropCalibrator.tsx'

// Access the calibrator tool at: http://localhost:5173/?calibrator
const isCalibrator = window.location.search.includes('calibrator');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCalibrator ? <DragAndDropCalibrator /> : <App />}
  </StrictMode>,
)
