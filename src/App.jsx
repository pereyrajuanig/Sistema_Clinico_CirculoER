import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'
import { ThemeProvider } from '@/lib/ThemeContext'
import ProtectedRoute from '@/components/ProtectedRoute'

// Code splitting por ruta: cada pantalla se pide recién cuando se navega a ella, en vez de
// sumarse todas al bundle inicial — el peso real de esta app está en las pantallas, no en
// el shell (login/routing/providers), así que separarlas por ruta es lo que más baja el
// tiempo de carga inicial real.
const Login = lazy(() => import('@/pages/Login'))
const Pacientes = lazy(() => import('@/pages/Pacientes'))
const HistoriaClinica = lazy(() => import('@/pages/HistoriaClinica'))
const UltimasConsultas = lazy(() => import('@/pages/UltimasConsultas'))
const Medicamentos = lazy(() => import('@/pages/Medicamentos'))
const MedicamentosInactivos = lazy(() => import('@/pages/MedicamentosInactivos'))
const HistorialMovimientos = lazy(() => import('@/pages/HistorialMovimientos'))

function CargandoPantalla() {
  return <p className="p-10 text-center text-text-secondary text-base">Cargando...</p>
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<CargandoPantalla />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Pacientes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pacientes/:id"
                element={
                  <ProtectedRoute>
                    <HistoriaClinica />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consultas/recientes"
                element={
                  <ProtectedRoute>
                    <UltimasConsultas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/medicamentos"
                element={
                  <ProtectedRoute>
                    <Medicamentos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/medicamentos/inactivos"
                element={
                  <ProtectedRoute>
                    <MedicamentosInactivos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/medicamentos/historial"
                element={
                  <ProtectedRoute>
                    <HistorialMovimientos />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
