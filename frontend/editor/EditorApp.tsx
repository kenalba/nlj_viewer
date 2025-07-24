/**
 * Editor Application
 * Main application for content creation and management
 */

import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, Avatar, Menu, MenuItem } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { ContentDashboard } from './ContentDashboard';
import { FlowEditor } from './FlowEditor';
import type { NLJScenario } from '../types/nlj';

const EditorNavBar: React.FC = () => {
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

  const handlePlayer = () => {
    navigate('/player');
    handleClose();
  };

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          NLJ Content Editor
        </Typography>
        
        {user && (
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2">
              {user.full_name || user.username}
            </Typography>
            <Typography variant="caption" sx={{ 
              bgcolor: 'secondary.main', 
              px: 1, 
              py: 0.5, 
              borderRadius: 1,
              textTransform: 'capitalize'
            }}>
              {user.role}
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
              <MenuItem onClick={handlePlayer}>Player</MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export const EditorApp: React.FC = () => {
  const [editingScenario, setEditingScenario] = useState<NLJScenario | null>(null);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <EditorNavBar />
      <Routes>
        <Route
          path="/"
          element={
            <ContentDashboard 
              onEditScenario={setEditingScenario}
            />
          }
        />
        <Route
          path="/flow-editor/:scenarioId?"
          element={
            editingScenario ? (
              <FlowEditor
                scenario={editingScenario}
                onBack={() => setEditingScenario(null)}
                onPlay={(scenario) => {
                  // Load scenario in player
                  console.log('Play scenario:', scenario.name);
                }}
                onSave={(scenario) => {
                  // Save scenario via API
                  console.log('Save scenario:', scenario.name);
                  setEditingScenario(scenario);
                }}
                onExport={(scenario) => {
                  // Export functionality
                  console.log('Export scenario:', scenario.name);
                }}
              />
            ) : (
              <div>No scenario selected</div>
            )
          }
        />
      </Routes>
    </Box>
  );
};