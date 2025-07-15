import React from 'react';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  LinearProgress,
  IconButton,
  Container,
} from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import type { NLJScenario } from '../types/nlj';
import { NodeRenderer } from './NodeRenderer';
import { useGameContext } from '../contexts/GameContext';
import { findNodeById } from '../utils/scenarioUtils';

interface GameViewProps {
  scenario: NLJScenario;
  onHome: () => void;
}

export const GameView: React.FC<GameViewProps> = ({ scenario, onHome }) => {
  const { state } = useGameContext();
  
  const currentNode = findNodeById(scenario, state.currentNodeId);
  const progress = (state.visitedNodes.size / scenario.nodes.length) * 100;

  if (!currentNode) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" color="error">
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
      flexDirection: 'column'
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
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600, color: 'white' }}>
            {scenario.name}
          </Typography>
          <Typography variant="body2" sx={{ 
            ml: 2, 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            px: 2, 
            py: 0.5, 
            borderRadius: 1,
            fontWeight: 500,
            color: 'white'
          }}>
            {Math.round(progress)}% Complete
          </Typography>
        </Toolbar>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ height: 4 }}
        />
      </AppBar>

      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        py: 4,
        px: 2
      }}>
        <Container maxWidth="md" sx={{ 
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <NodeRenderer node={currentNode} scenario={scenario} />
        </Container>
      </Box>
    </Box>
  );
};