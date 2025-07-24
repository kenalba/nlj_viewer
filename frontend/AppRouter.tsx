/**
 * Application Router
 * Defines routes for Player, Editor, and Authentication flows
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';  
import { PlayerApp } from './player/PlayerApp';
import { EditorApp } from './editor/EditorApp';
import { LoadingSpinner } from './shared/LoadingSpinner';

// Protected Route component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'creator' | 'reviewer' | 'approver' | 'admin';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole 
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role requirements
  if (requiredRole && user?.role !== requiredRole) {
    // Allow admin access to everything
    if (user?.role !== 'admin') {
      return <Navigate to="/player" replace />;
    }
  }

  return <>{children}</>;
};

export const AppRouter: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/player" replace /> : <LoginPage />
          } 
        />

        {/* Player Routes - Available to all authenticated users */}
        <Route
          path="/player/*"
          element={
            <ProtectedRoute>
              <PlayerApp />
            </ProtectedRoute>
          }
        />

        {/* Editor Routes - Available to creators, reviewers, approvers, and admins */}
        <Route
          path="/editor/*"
          element={
            <ProtectedRoute>
              <EditorApp />
            </ProtectedRoute>
          }
        />

        {/* Default redirects */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/player" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};