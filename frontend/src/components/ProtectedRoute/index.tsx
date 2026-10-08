import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Array<'admin' | 'user'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles: _roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Carregando...</div>; // Ou um spinner de carregamento
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Branch sem controle de acesso: qualquer usuário autenticado tem acesso total
  /*
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  */

  return <>{children}</>;
};

export default ProtectedRoute;
