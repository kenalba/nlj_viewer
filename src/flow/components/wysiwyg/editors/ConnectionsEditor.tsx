/**
 * ConnectionsEditor - Editor for Connections game configuration
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  TextField,
  Chip,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../../types/flow';
import type { NLJNode, ConnectionsNode, ConnectionsGroup } from '../../../../types/nlj';

interface ConnectionsEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
}

const difficultyColors = {
  yellow: '#f1c40f',
  green: '#2ecc71',
  blue: '#3498db',
  purple: '#9b59b6'
};

export const ConnectionsEditor: React.FC<ConnectionsEditorProps> = ({
  node,
  onUpdate,
}) => {
  const connectionsNode = node.data.nljNode as ConnectionsNode;
  const gameData = connectionsNode.gameData || { words: [], groups: [] };

  const handleUpdateGameData = (updates: Partial<typeof gameData>) => {
    onUpdate({
      gameData: { ...gameData, ...updates }
    });
  };

  const handleAddGroup = () => {
    const newGroup: ConnectionsGroup = {
      name: 'New Group',
      words: ['', '', '', ''],
      difficulty: 'yellow'
    };
    handleUpdateGameData({
      groups: [...gameData.groups, newGroup]
    });
  };

  const handleUpdateGroup = (index: number, updates: Partial<ConnectionsGroup>) => {
    const newGroups = [...gameData.groups];
    newGroups[index] = { ...newGroups[index], ...updates };
    handleUpdateGameData({ groups: newGroups });
    
    // Update words array based on all groups
    const allWords = newGroups.flatMap(group => group.words);
    handleUpdateGameData({ words: allWords });
  };

  const handleDeleteGroup = (index: number) => {
    const newGroups = gameData.groups.filter((_, i) => i !== index);
    handleUpdateGameData({ groups: newGroups });
    
    // Update words array
    const allWords = newGroups.flatMap(group => group.words);
    handleUpdateGameData({ words: allWords });
  };

  const handleUpdateWord = (groupIndex: number, wordIndex: number, word: string) => {
    const newGroups = [...gameData.groups];
    newGroups[groupIndex].words[wordIndex] = word.toUpperCase();
    handleUpdateGameData({ groups: newGroups });
    
    // Update words array
    const allWords = newGroups.flatMap(group => group.words);
    handleUpdateGameData({ words: allWords });
  };

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Connections Game Configuration
      </Typography>

      {/* Game Description */}
      <Alert severity="info">
        <Typography variant="body2">
          Create 4 groups of 4 related words each. Players must find the connections between words.
          Difficulty increases from Yellow (easiest) to Purple (hardest).
        </Typography>
      </Alert>

      {/* Groups */}
      <Stack spacing={2}>
        {gameData.groups.map((group, groupIndex) => (
          <Paper key={groupIndex} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              
              {/* Group Header */}
              <Stack direction="row" alignItems="center" spacing={2}>
                <TextField
                  label="Group Name"
                  value={group.name}
                  onChange={(e) => handleUpdateGroup(groupIndex, { name: e.target.value.toUpperCase() })}
                  size="small"
                  sx={{ flexGrow: 1 }}
                />
                
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    value={group.difficulty}
                    onChange={(e) => handleUpdateGroup(groupIndex, { difficulty: e.target.value as any })}
                    label="Difficulty"
                  >
                    <MenuItem value="yellow">Yellow</MenuItem>
                    <MenuItem value="green">Green</MenuItem>
                    <MenuItem value="blue">Blue</MenuItem>
                    <MenuItem value="purple">Purple</MenuItem>
                  </Select>
                </FormControl>
                
                <Chip
                  label={group.difficulty}
                  size="small"
                  sx={{ 
                    bgcolor: difficultyColors[group.difficulty], 
                    color: 'white',
                    textTransform: 'capitalize'
                  }}
                />
                
                <Button
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDeleteGroup(groupIndex)}
                  disabled={gameData.groups.length <= 1}
                >
                  Delete
                </Button>
              </Stack>

              {/* Words */}
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Words (4 required)
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {group.words.map((word, wordIndex) => (
                    <TextField
                      key={wordIndex}
                      value={word}
                      onChange={(e) => handleUpdateWord(groupIndex, wordIndex, e.target.value)}
                      size="small"
                      placeholder={`Word ${wordIndex + 1}`}
                      sx={{ width: 120 }}
                      inputProps={{ maxLength: 12 }}
                    />
                  ))}
                </Stack>
              </Box>

            </Stack>
          </Paper>
        ))}
      </Stack>

      {/* Add Group Button */}
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={handleAddGroup}
        disabled={gameData.groups.length >= 4}
        sx={{ alignSelf: 'flex-start' }}
      >
        Add Group (Max 4)
      </Button>

      {/* Game Statistics */}
      <Alert severity="info">
        <Typography variant="body2">
          <strong>Current Setup:</strong> {gameData.groups.length} groups, {gameData.words.length} words total
          {gameData.groups.length === 4 && gameData.words.length === 16 && (
            <span style={{ color: 'green' }}> ✓ Ready to play!</span>
          )}
        </Typography>
      </Alert>
    </Stack>
  );
};