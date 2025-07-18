import React, { useEffect } from 'react';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton,
  Container,
} from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import type { NLJScenario } from '../types/nlj';
import { NodeRenderer } from './NodeRenderer';
import { CardTransition } from './CardTransition';
import { useGameContext } from '../contexts/GameContext';
import { useXAPI } from '../contexts/XAPIContext';
import { findNodeById } from '../utils/scenarioUtils';
import { ThemeToggle } from './ThemeToggle';
import { SoundToggle } from './SoundToggle';

interface GameViewProps {
  scenario: NLJScenario;
  onHome: () => void;
}

export const GameView: React.FC<GameViewProps> = ({ scenario, onHome }) => {
  const { state } = useGameContext();
  const { trackActivityLaunched } = useXAPI();
  
  const currentNode = findNodeById(scenario, state.currentNodeId);
  
  // Track activity launch only once when component mounts
  useEffect(() => {
    trackActivityLaunched(scenario);
  }, [scenario.id]); // Only depend on scenario ID, not the function
  
  // Don't auto-track node visits - only track user actions

  if (!currentNode) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">
          Node not found: {state.currentNodeId}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      width: '100%',
      backgroundColor: 'background.default',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'visible',
    }}>
      <AppBar position="static" elevation={0} sx={{ width: '100%' }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onHome}
            sx={{ mr: 2 }}
          >
            <HomeIcon />
          </IconButton>
          <Typography component="div" sx={{ flexGrow: 1, fontWeight: 600, color: 'white' }}>
            {scenario.name}
          </Typography>
          <SoundToggle />
          <ThemeToggle />
        </Toolbar>
      </AppBar>

      <Box sx={{ 
        flex: 1, 
        display: 'flex',
        flexDirection: 'column',
        py: { xs: 0, sm: 4 },
        px: { xs: 0, sm: 2 },
        overflow: 'visible',
      }}>
        <Container maxWidth="md" sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 0, sm: 2 },
          overflow: 'visible',
        }}>
          <CardTransition nodeId={state.currentNodeId}>
            <NodeRenderer node={currentNode} scenario={scenario} />
          </CardTransition>
        </Container>
      </Box>
    </Box>
  );
};