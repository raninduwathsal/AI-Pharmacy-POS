import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Receipt from './pages/Receipt';
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/receipt/:id" element={<Receipt />} />
        {/* Default route explicitly redirects to login if unauth to prevent 404s, otherwise dashboard */}
        <Route path="*" element={localStorage.getItem('token') ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
