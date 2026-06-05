import { useContext, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Projetos from './pages/Projetos';
import ProjectView from './pages/ProjectView';
import ProjectResults from './pages/ProjectResults';
import OtherModules from './pages/OtherModules';
import Dashboard from './pages/Dashboard';
import RegisterUser from './pages/RegisterUser';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword'; 
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import ReviewImages from './pages/ReviewImages'; // Import the new component
import { ThemeContext } from './contexts/ThemeContext';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="projetos" element={
          <ProtectedRoute>
            <Projetos />
          </ProtectedRoute>
        } />
        <Route path="projetos/:id" element={
          <ProtectedRoute>
            <ProjectView />
          </ProtectedRoute>
        } />
        <Route path="projetos/:id/results" element={
          <ProtectedRoute>
            <ProjectResults />
          </ProtectedRoute>
        } />
        <Route path="projetos/outros-modulos" element={
          <ProtectedRoute>
            <OtherModules />
          </ProtectedRoute>
        } />
        <Route path="projetos/:id/dashboard" element={ 
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="review/:reviewId" element={
          <ProtectedRoute>
            <ReviewImages />
          </ProtectedRoute>
        } />
        <Route path="profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="change-password" element={ 
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        } />
        <Route path="admin" element={
          <ProtectedRoute roles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="register-user" element={<RegisterUser />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
