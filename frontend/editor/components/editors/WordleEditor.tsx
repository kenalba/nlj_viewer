/**
 * WordleEditor - Editor for Wordle game configuration
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  Slider,
  InputAdornment,
} from '@mui/material';
import {
  Lightbulb as HintIcon,
  Keyboard as KeyboardIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';

import type { FlowNode } from '../../flow/types/flow';
import type { NLJNode, WordleNode } from '../../../../types/nlj';

interface WordleEditorProps {
  node: FlowNode;
  onUpdate: (updates: Partial<NLJNode>) => void;
}

export const WordleEditor: React.FC<WordleEditorProps> = ({
  node,
  onUpdate,
}) => {
  const wordleNode = node.data.nljNode as WordleNode;
  const gameData = wordleNode.gameData || { targetWord: '', maxAttempts: 6, wordLength: 5 };

  const handleUpdateGameData = (updates: Partial<typeof gameData>) => {
    onUpdate({
      gameData: { ...gameData, ...updates }
    });
  };

  const handleUpdateNode = (updates: Partial<WordleNode>) => {
    onUpdate(updates);
  };

  const handleTargetWordChange = (word: string) => {
    const cleanWord = word.toUpperCase().replace(/[^A-Z]/g, '');
    handleUpdateGameData({ 
      targetWord: cleanWord,
      wordLength: cleanWord.length
    });
  };

  const isValidWord = (word: string) => {
    return word.length >= 3 && word.length <= 8 && /^[A-Z]+$/.test(word);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Wordle Game Configuration
      </Typography>

      {/* Game Description */}
      <Alert severity="info">
        <Typography variant="body2">
          Players guess the target word within a limited number of attempts. 
          Each guess provides feedback about letter positions and accuracy.
        </Typography>
      </Alert>

      {/* Core Game Settings */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={3}>
          
          <Typography variant="h6">Core Settings</Typography>

          {/* Target Word */}
          <TextField
            label="Target Word"
            value={gameData.targetWord}
            onChange={(e) => handleTargetWordChange(e.target.value)}
            placeholder="Enter target word..."
            helperText={`${gameData.targetWord.length} letters. Only A-Z allowed.`}
            error={gameData.targetWord.length > 0 && !isValidWord(gameData.targetWord)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {isValidWord(gameData.targetWord) ? '✓' : '✗'}
                </InputAdornment>
              )
            }}
          />

          {/* Max Attempts */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Maximum Attempts: {gameData.maxAttempts}
            </Typography>
            <Slider
              value={gameData.maxAttempts}
              onChange={(_, value) => handleUpdateGameData({ maxAttempts: value as number })}
              min={3}
              max={10}
              step={1}
              marks
              valueLabelDisplay="auto"
            />
          </Box>

        </Stack>
      </Paper>

      {/* Game Features */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          
          <Typography variant="h6">Game Features</Typography>

          <FormControlLabel
            control={
              <Switch
                checked={wordleNode.showKeyboard ?? true}
                onChange={(e) => handleUpdateNode({ showKeyboard: e.target.checked })}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <KeyboardIcon fontSize="small" />
                <span>Show Virtual Keyboard</span>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={wordleNode.allowHints ?? true}
                onChange={(e) => handleUpdateNode({ allowHints: e.target.checked })}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HintIcon fontSize="small" />
                <span>Allow Hints</span>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={wordleNode.hardMode ?? false}
                onChange={(e) => handleUpdateNode({ hardMode: e.target.checked })}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimerIcon fontSize="small" />
                <span>Hard Mode (revealed hints must be used)</span>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={wordleNode.colorblindMode ?? false}
                onChange={(e) => handleUpdateNode({ colorblindMode: e.target.checked })}
              />
            }
            label="Colorblind-Friendly Mode"
          />

        </Stack>
      </Paper>

      {/* Scoring Settings */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          
          <Typography variant="h6">Scoring (Optional)</Typography>

          <TextField
            label="Base Points"
            type="number"
            value={wordleNode.scoring?.basePoints ?? 100}
            onChange={(e) => handleUpdateNode({ 
              scoring: { 
                ...wordleNode.scoring, 
                basePoints: parseInt(e.target.value) || 100 
              } 
            })}
            size="small"
            helperText="Points awarded for solving the puzzle"
          />

          <TextField
            label="Bonus Per Remaining Attempt"
            type="number"
            value={wordleNode.scoring?.bonusPerRemainingAttempt ?? 10}
            onChange={(e) => handleUpdateNode({ 
              scoring: { 
                ...wordleNode.scoring, 
                bonusPerRemainingAttempt: parseInt(e.target.value) || 10 
              } 
            })}
            size="small"
            helperText="Extra points for each unused attempt"
          />

          <TextField
            label="Hint Penalty"
            type="number"
            value={wordleNode.scoring?.hintPenalty ?? 5}
            onChange={(e) => handleUpdateNode({ 
              scoring: { 
                ...wordleNode.scoring, 
                hintPenalty: parseInt(e.target.value) || 5 
              } 
            })}
            size="small"
            helperText="Points deducted for using hints"
          />

        </Stack>
      </Paper>

      {/* Game Status */}
      <Alert severity={isValidWord(gameData.targetWord) ? "success" : "warning"}>
        <Typography variant="body2">
          <strong>Game Status:</strong> 
          {isValidWord(gameData.targetWord) ? (
            <span style={{ color: 'green' }}> ✓ Ready to play! Target: {gameData.targetWord} ({gameData.wordLength} letters, {gameData.maxAttempts} attempts)</span>
          ) : (
            <span style={{ color: 'orange' }}> ⚠ Need valid target word (3-8 letters, A-Z only)</span>
          )}
        </Typography>
      </Alert>
    </Stack>
  );
};