import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Proyectos from './pages/Proyectos';
import ProyectoDetalle from './pages/ProyectoDetalle';
import MisTareas from './pages/MisTareas';
import Gantt from './pages/Gantt';
import Usuarios from './pages/Usuarios';
import Metodologia from './pages/Metodologia';
import OlvidePassword from './pages/OlvidePassword';
import RestablecerPassword from './pages/RestablecerPassword';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/olvide-password" element={<OlvidePassword />} />
        <Route path="/restablecer-password" element={<RestablecerPassword />} />
        <Route
          path="/cambiar-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/proyectos"
          element={
            <ProtectedRoute>
              <Proyectos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/proyectos/:id"
          element={
            <ProtectedRoute>
              <ProyectoDetalle />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-tareas"
          element={
            <ProtectedRoute>
              <MisTareas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gantt"
          element={
            <ProtectedRoute>
              <Gantt />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <Usuarios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/metodologia"
          element={
            <ProtectedRoute>
              <Metodologia />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
