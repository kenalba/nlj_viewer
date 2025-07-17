import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WordleNode } from '../WordleNode';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { hyundaiTheme } from '../../theme/hyundaiTheme';
import { unfilteredTheme } from '../../theme/unfilteredTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import type { WordleNode as WordleNodeType } from '../../types/nlj';

// Mock the audio context
const mockPlaySound = vi.fn();
vi.mock('../../contexts/AudioContext', () => ({
  useAudio: () => ({
    playSound: mockPlaySound,
  }),
}));

// Mock the xAPI context
const mockTrackActivityLaunched = vi.fn();
const mockTrackQuestionAnswered = vi.fn();
const mockTrackActivityCompleted = vi.fn();
vi.mock('../../contexts/XAPIContext', () => ({
  useXAPI: () => ({
    trackActivityLaunched: mockTrackActivityLaunched,
    trackQuestionAnswered: mockTrackQuestionAnswered,
    trackActivityCompleted: mockTrackActivityCompleted,
  }),
}));

// Mock the GameContext
const mockReset = vi.fn();
vi.mock('../../contexts/GameContext', () => ({
  useGameContext: () => ({
    reset: mockReset,
  }),
}));

// Mock the MarkdownRenderer to return plain text
vi.mock('../MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

// Mock the MediaDisplay component
vi.mock('../MediaDisplay', () => ({
  MediaDisplay: ({ mediaList }: { mediaList: any[] }) => (
    <div data-testid="media-display">Media: {mediaList.length} items</div>
  ),
}));

// Mock the MediaViewer component
vi.mock('../MediaViewer', () => ({
  MediaViewer: ({ media }: { media: any }) => (
    <div data-testid="media-viewer">Media: {media.type}</div>
  ),
}));

// Mock mobile detection
vi.mock('../../utils/mobileDetection', () => ({
  useIsMobile: () => false,
}));

// Mock word validation
vi.mock('../../utils/wordValidation', () => ({
  isValidWord: vi.fn((word: string) => {
    // Mock validation - accept common test words
    const validWords = ['REACT', 'TESTS', 'WORLD', 'HELLO', 'WRONG', 'VALID'];
    return validWords.includes(word.toUpperCase());
  }),
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; theme?: 'hyundai' | 'unfiltered' }> = ({ 
  children, 
  theme = 'hyundai' 
}) => (
  <ThemeProvider initialTheme={theme}>
    <MuiThemeProvider theme={theme === 'hyundai' ? hyundaiTheme : unfilteredTheme}>
      {children}
    </MuiThemeProvider>
  </ThemeProvider>
);

// Mock question data
const mockQuestion: WordleNodeType = {
  id: 'test-wordle-1',
  type: 'wordle',
  text: 'Guess the 5-letter word!',
  content: 'Use the keyboard to make guesses. Green means correct position, yellow means wrong position.',
  x: 100,
  y: 100,
  width: 600,
  height: 500,
  gameData: {
    targetWord: 'REACT',
    wordLength: 5,
    maxAttempts: 6,
    validWords: ['REACT', 'TESTS', 'WORLD', 'HELLO', 'WRONG', 'VALID'],
    hints: ['It\'s a popular JavaScript library', 'Used for building user interfaces']
  },
  hardMode: false,
  allowHints: true,
  scoring: {
    basePoints: 100,
    bonusPerRemainingAttempt: 20,
    hintPenalty: 10
  }
};

describe('WordleNode', () => {
  const mockOnAnswer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with game title and instructions', () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.getByText('Guess the 5-letter word!')).toBeInTheDocument();
    expect(screen.getByText('Use the keyboard to make guesses. Green means correct position, yellow means wrong position.')).toBeInTheDocument();
  });

  it('displays game status correctly', () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.getByText('Attempt 1 of 6')).toBeInTheDocument();
  });

  it('displays hard mode indicator when enabled', () => {
    const hardModeQuestion = { ...mockQuestion, hardMode: true };
    render(
      <TestWrapper>
        <WordleNode question={hardModeQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.getByText('Hard Mode')).toBeInTheDocument();
  });

  it('displays hint button when hints are allowed', () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.getByText('Hint')).toBeInTheDocument();
  });

  it('shows hint when hint button is clicked', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const hintButton = screen.getByText('Hint');
    fireEvent.click(hintButton);

    await waitFor(() => {
      expect(screen.getByText('Hint:')).toBeInTheDocument();
      expect(screen.getByText('It\'s a popular JavaScript library')).toBeInTheDocument();
    });
  });

  it('allows typing in the input field', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'HELLO' } });

    await waitFor(() => {
      expect(input).toHaveValue('HELLO');
    });
  });

  it('converts input to uppercase', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'hello' } });

    await waitFor(() => {
      expect(input).toHaveValue('HELLO');
    });
  });

  it('limits input to word length', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    
    // First, enter a valid 5-letter word
    fireEvent.change(input, { target: { value: 'HELLO' } });
    await waitFor(() => {
      expect(input).toHaveValue('HELLO');
    });

    // Try to enter a longer word - it should not update
    fireEvent.change(input, { target: { value: 'TOOLONG' } });
    await waitFor(() => {
      expect(input).toHaveValue('HELLO'); // Should still be the previous valid value
    });
  });

  it('only allows letter characters', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    
    // First enter valid letters
    fireEvent.change(input, { target: { value: 'HE' } });
    await waitFor(() => {
      expect(input).toHaveValue('HE');
    });

    // Try to enter invalid characters - should not update
    fireEvent.change(input, { target: { value: 'HE11O' } });
    await waitFor(() => {
      expect(input).toHaveValue('HE'); // Should still be the previous valid value
    });
  });

  it('enables submit button only when word is complete', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const submitButton = screen.getByText('Submit');
    expect(submitButton).toBeDisabled();

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'HELLO' } });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('submits guess on Enter key press', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'HELLO' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockTrackQuestionAnswered).toHaveBeenCalledWith(
        'test-wordle-1',
        'wordle',
        'HELLO',
        false,
        0,
        1
      );
    });
  });

  it('disables submit button for incomplete word', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'HEL' } });
    
    const submitButton = screen.getByText('Submit');
    expect(submitButton).toBeDisabled();
  });

  it('shows error for invalid word', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'ZZZZZ' } });
    
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Not a valid word')).toBeInTheDocument();
    });
  });

  it('displays guess in the grid after submission', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'HELLO' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Attempt 2 of 6')).toBeInTheDocument();
    });
  });

  it('handles winning the game', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'REACT' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText(/Congratulations!/)).toBeInTheDocument();
      expect(screen.getByText(/You solved it in 1 attempt!/)).toBeInTheDocument();
      expect(screen.getByText('Return to Menu')).toBeInTheDocument();
    });

    expect(mockPlaySound).toHaveBeenCalledWith('correct');
    expect(mockTrackActivityCompleted).toHaveBeenCalled();
    expect(mockOnAnswer).toHaveBeenCalledWith({
      guesses: expect.any(Array),
      attempts: 1,
      completed: true,
      won: true
    });
  });

  it('handles losing the game after max attempts', async () => {
    const shortGameQuestion = { 
      ...mockQuestion, 
      gameData: { ...mockQuestion.gameData, maxAttempts: 1 } 
    };
    render(
      <TestWrapper>
        <WordleNode question={shortGameQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'WRONG' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText(/Game Over!/)).toBeInTheDocument();
      expect(screen.getByText(/The word was:/)).toBeInTheDocument();
      expect(screen.getByText('REACT')).toBeInTheDocument();
      expect(screen.getByText('Return to Menu')).toBeInTheDocument();
    });

    expect(mockPlaySound).toHaveBeenCalledWith('incorrect');
    expect(mockTrackActivityCompleted).toHaveBeenCalled();
    expect(mockOnAnswer).toHaveBeenCalledWith({
      guesses: expect.any(Array),
      attempts: 1,
      completed: true,
      won: false
    });
  });

  it('tracks activity launch on mount', () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(mockTrackActivityLaunched).toHaveBeenCalledWith({
      id: 'test-wordle-1',
      name: 'Guess the 5-letter word!',
      nodes: [],
      links: [],
      orientation: 'vertical',
      activityType: 'game'
    });
  });

  it('renders with different themes', () => {
    const { rerender } = render(
      <TestWrapper theme="hyundai">
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.getByText('Guess the 5-letter word!')).toBeInTheDocument();

    rerender(
      <TestWrapper theme="unfiltered">
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.getByText('Guess the 5-letter word!')).toBeInTheDocument();
  });

  it('handles Return to Menu button click', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    // Win the game first
    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'REACT' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Return to Menu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Return to Menu'));
    expect(mockReset).toHaveBeenCalled();
  });

  it('displays media when present', () => {
    const questionWithMedia = {
      ...mockQuestion,
      media: { id: 'test-media', type: 'IMAGE' as const, fullPath: 'test.jpg', title: 'Test Image' }
    };

    render(
      <TestWrapper>
        <WordleNode question={questionWithMedia} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.getByTestId('media-display')).toBeInTheDocument();
  });

  it('displays additional media when present', () => {
    const questionWithAdditionalMedia = {
      ...mockQuestion,
      additionalMediaList: [{ media: { id: 'test-media-2', type: 'VIDEO' as const, fullPath: 'test.mp4', title: 'Test Video' } }]
    };

    render(
      <TestWrapper>
        <WordleNode question={questionWithAdditionalMedia} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.getByTestId('media-viewer')).toBeInTheDocument();
  });

  it('calculates score correctly', async () => {
    const questionWithScoring = {
      ...mockQuestion,
      scoring: {
        basePoints: 100,
        bonusPerRemainingAttempt: 20,
        hintPenalty: 10
      }
    };

    render(
      <TestWrapper>
        <WordleNode question={questionWithScoring} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    // Win on first try
    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'REACT' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockTrackActivityCompleted).toHaveBeenCalledWith(
        expect.any(Object),
        200 // basePoints (100) + bonusPerRemainingAttempt (20) * remainingAttempts (5)
      );
    });
  });

  it('updates progress bar correctly', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');

    // Make one guess
    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'WRONG' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      const updatedProgressBar = screen.getByRole('progressbar');
      const value = parseFloat(updatedProgressBar.getAttribute('aria-valuenow') || '0');
      expect(value).toBeCloseTo(16.67, 0); // 1/6 * 100, rounded to nearest integer
    });
  });

  it('handles questions without hints', () => {
    const questionWithoutHints = {
      ...mockQuestion,
      allowHints: false,
      gameData: {
        ...mockQuestion.gameData,
        hints: undefined
      }
    };

    render(
      <TestWrapper>
        <WordleNode question={questionWithoutHints} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });

  it('handles questions with different word lengths', () => {
    const fourLetterQuestion = {
      ...mockQuestion,
      gameData: {
        ...mockQuestion.gameData,
        targetWord: 'TEST',
        wordLength: 4
      }
    };

    render(
      <TestWrapper>
        <WordleNode question={fourLetterQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    expect(screen.getByPlaceholderText('Enter 4-letter word')).toBeInTheDocument();
  });

  it('disables hint button after being used', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const hintButton = screen.getByText('Hint');
    expect(hintButton).not.toBeDisabled();

    fireEvent.click(hintButton);

    await waitFor(() => {
      expect(hintButton).toBeDisabled();
    });
  });

  it('clears input after successful guess', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    fireEvent.change(input, { target: { value: 'WRONG' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('clears error after successful input', async () => {
    render(
      <TestWrapper>
        <WordleNode question={mockQuestion} onAnswer={mockOnAnswer} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter 5-letter word');
    
    // Trigger error with invalid word
    fireEvent.change(input, { target: { value: 'ZZZZZ' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Not a valid word')).toBeInTheDocument();
    });

    // Clear error by typing a valid word
    fireEvent.change(input, { target: { value: 'HELLO' } });

    await waitFor(() => {
      expect(screen.queryByText('Not a valid word')).not.toBeInTheDocument();
    });
  });
});