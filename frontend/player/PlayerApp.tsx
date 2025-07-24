/**
 * Player Application
 * Main application for playing NLJ scenarios
 */

import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, Avatar, Menu, MenuItem } from '@mui/material';
import { GameProvider, useGameContext } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { GameView } from './GameView';
import { ScenarioLoader } from './ScenarioLoader';
import { XAPIResultsScreen } from './XAPIResultsScreen';
import type { NLJScenario } from '../types/nlj';

const PlayerContent: React.FC = () => {
  const { state, reset, loadScenario } = useGameContext();
  const [currentScenario, setCurrentScenario] = useState<NLJScenario | null>(null);
  
  // Load scenario from localStorage when game state changes
  useEffect(() => {
    if (state.scenarioId) {
      const scenarioData = localStorage.getItem(`scenario_${state.scenarioId}`);
      if (scenarioData) {
        setCurrentScenario(JSON.parse(scenarioData));
      }
    } else {
      setCurrentScenario(null);
    }
  }, [state.scenarioId]);

  const handleHome = () => {
    reset();
    setCurrentScenario(null);
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          state.scenarioId && state.currentNodeId && currentScenario ? (
            <GameView 
              scenario={currentScenario} 
              onHome={handleHome}
            />
          ) : (
            <ScenarioLoader 
              onFlowEdit={() => {
                // In player mode, we don't allow flow editing
                // This could redirect to editor if user has permissions
              }}
            />
          )
        }
      />
      <Route
        path="/results/:sessionId"
        element={<XAPIResultsScreen />}
      />
    </Routes>
  );
};

const PlayerNavBar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  const handleEditor = () => {
    navigate('/editor');
    handleClose();
  };

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          NLJ Player
        </Typography>
        
        {user && (
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2">
              {user.full_name || user.username}
            </Typography>
            <Button
              onClick={handleMenu}
              sx={{ p: 0, minWidth: 'auto' }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user.username.charAt(0).toUpperCase()}
              </Avatar>
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              {(user.role === 'creator' || user.role === 'reviewer' || 
                user.role === 'approver' || user.role === 'admin') && (
                <MenuItem onClick={handleEditor}>Editor</MenuItem>
              )}
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export const PlayerApp: React.FC = () => {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <PlayerNavBar />
      <GameProvider>
        <PlayerContent />
      </GameProvider>
    </Box>
  );
};