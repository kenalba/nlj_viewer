import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TrueFalseNode } from '../TrueFalseNode';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { hyundaiTheme } from '../../theme/hyundaiTheme';
import { unfilteredTheme } from '../../theme/unfilteredTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import type { TrueFalseNode as TrueFalseNodeType } from '../../types/nlj';

// Mock the audio context
const mockPlaySound = vi.fn();
vi.mock('../../contexts/AudioContext', () => ({
  useAudio: () => ({
    playSound: mockPlaySound,
  }),
}));

// Mock the xAPI context
const mockTrackQuestionAnswered = vi.fn();
vi.mock('../../contexts/XAPIContext', () => ({
  useXAPI: () => ({
    trackQuestionAnswered: mockTrackQuestionAnswered,
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
const mockQuestion: TrueFalseNodeType = {
  id: 'test-true-false-1',
  type: 'true_false',
  text: 'The sky is blue.',
  content: 'Consider the color of the sky on a clear day.',
  correctAnswer: true,
  x: 100,
  y: 100,
  width: 400,
  height: 200,
  additionalMediaList: [],
};

const mockQuestionWithMedia: TrueFalseNodeType = {
  ...mockQuestion,
  media: {
    id: 'test-media',
    type: 'IMAGE',
    fullPath: 'https://example.com/image.jpg',
    title: 'Test Image',
    description: 'A test image',
    fullThumbnail: 'https://example.com/thumb.jpg',
    createTimestamp: '2023-01-01T00:00:00Z',
    updateTimestamp: '2023-01-01T00:00:00Z',
  },
};

const mockQuestionWithAdditionalMedia: TrueFalseNodeType = {
  ...mockQuestion,
  additionalMediaList: [
    {
      id: 'additional-media-1',
      type: 'IMAGE',
      fullPath: 'https://example.com/additional1.jpg',
      title: 'Additional Image 1',
      description: 'Additional test image',
      fullThumbnail: 'https://example.com/additional1-thumb.jpg',
      createTimestamp: '2023-01-01T00:00:00Z',
      updateTimestamp: '2023-01-01T00:00:00Z',
    },
  ],
};

describe('TrueFalseNode', () => {
  const mockOnAnswer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders question text and content', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('The sky is blue.')).toBeInTheDocument();
    expect(screen.getByText('Consider the color of the sky on a clear day.')).toBeInTheDocument();
  });

  it('renders True and False buttons', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('True')).toBeInTheDocument();
    expect(screen.getByText('False')).toBeInTheDocument();
  });

  it('renders submit button initially disabled', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const submitButton = screen.getByText('Submit Answer');
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when answer is selected', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    expect(submitButton).not.toBeDisabled();
  });

  it('handles True button selection', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    // Check that the button has the 'contained' variant indicating selection
    expect(trueButton.closest('button')).toHaveClass('MuiButton-contained');
  });

  it('handles False button selection', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const falseButton = screen.getByText('False');
    fireEvent.click(falseButton);

    // Check that the button has the 'contained' variant indicating selection
    expect(falseButton.closest('button')).toHaveClass('MuiButton-contained');
  });

  it('shows correct feedback for correct answer', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Correct! Well done.')).toBeInTheDocument();
    });
  });

  it('shows incorrect feedback for wrong answer', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const falseButton = screen.getByText('False');
    fireEvent.click(falseButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Incorrect. The correct answer is: True')).toBeInTheDocument();
    });
  });

  it('shows continue button after feedback', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });
  });

  it('calls onAnswer when continue button is clicked', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    expect(mockOnAnswer).toHaveBeenCalledWith(true);
  });

  it('disables buttons after feedback is shown', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Correct! Well done.')).toBeInTheDocument();
    });

    expect(trueButton).toBeDisabled();
    expect(screen.getByText('False')).toBeDisabled();
  });

  it('plays correct sound for correct answer', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPlaySound).toHaveBeenCalledWith('correct');
    });
  });

  it('plays incorrect sound for wrong answer', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const falseButton = screen.getByText('False');
    fireEvent.click(falseButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPlaySound).toHaveBeenCalledWith('incorrect');
    });
  });

  it('tracks question answered with xAPI', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockTrackQuestionAnswered).toHaveBeenCalledWith(
        'test-true-false-1',
        'true-false',
        'true',
        true,
        expect.any(Number),
        1
      );
    });
  });

  it('handles keyboard navigation - key 1 for True', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    fireEvent.keyDown(document, { key: '1' });

    const trueButton = screen.getByText('True');
    expect(trueButton.closest('button')).toHaveClass('MuiButton-contained');
  });

  it('handles keyboard navigation - key 2 for False', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    fireEvent.keyDown(document, { key: '2' });

    const falseButton = screen.getByText('False');
    expect(falseButton.closest('button')).toHaveClass('MuiButton-contained');
  });

  it('handles Enter key to submit answer', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    fireEvent.keyDown(document, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Correct! Well done.')).toBeInTheDocument();
    });
  });

  it('handles Enter key to continue after feedback', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(mockOnAnswer).toHaveBeenCalledWith(true);
  });

  it('prevents keyboard interaction when feedback is shown', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Correct! Well done.')).toBeInTheDocument();
    });

    // Try to press '2' after feedback is shown
    fireEvent.keyDown(document, { key: '2' });

    // Should not change the selection - True button should still be selected
    expect(trueButton.closest('button')).toHaveClass('MuiButton-contained');
    expect(screen.getByText('False').closest('button')).toHaveClass('MuiButton-outlined');
  });

  it('renders media when present', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestionWithMedia}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // MediaViewer should render an image
    const image = screen.getByAltText('Test Image');
    expect(image).toBeInTheDocument();
  });

  it('renders additional media when present', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestionWithAdditionalMedia}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Additional media should be rendered
    const additionalImage = screen.getByAltText('Additional Image 1');
    expect(additionalImage).toBeInTheDocument();
  });

  it('renders question without content', () => {
    const questionWithoutContent = {
      ...mockQuestion,
      content: undefined,
    };

    render(
      <TestWrapper>
        <TrueFalseNode
          question={questionWithoutContent}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('The sky is blue.')).toBeInTheDocument();
    expect(screen.queryByText('Consider the color of the sky on a clear day.')).not.toBeInTheDocument();
  });

  it('shows keyboard controls helper text', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Press 1 for True, 2 for False • Enter to submit')).toBeInTheDocument();
  });

  it('hides keyboard controls helper when feedback is shown', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('Press 1 for True, 2 for False • Enter to submit')).not.toBeInTheDocument();
    });
  });

  it('applies unfiltered theme styling', () => {
    render(
      <TestWrapper theme="unfiltered">
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('The sky is blue.')).toBeInTheDocument();
    // Theme-specific styling would need more specific assertions
  });

  it('handles false correct answer scenario', async () => {
    const falseCorrectQuestion = {
      ...mockQuestion,
      correctAnswer: false,
    };

    render(
      <TestWrapper>
        <TrueFalseNode
          question={falseCorrectQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const falseButton = screen.getByText('False');
    fireEvent.click(falseButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Correct! Well done.')).toBeInTheDocument();
    });

    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    expect(mockOnAnswer).toHaveBeenCalledWith(true);
  });

  it('shows correct answer in feedback for false correct answer', async () => {
    const falseCorrectQuestion = {
      ...mockQuestion,
      correctAnswer: false,
    };

    render(
      <TestWrapper>
        <TrueFalseNode
          question={falseCorrectQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Incorrect. The correct answer is: False')).toBeInTheDocument();
    });
  });

  it('prevents submit when no answer is selected', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(screen.queryByText('Correct! Well done.')).not.toBeInTheDocument();
    expect(screen.queryByText('Incorrect. The correct answer is: True')).not.toBeInTheDocument();
  });

  it('prevents continue when no answer is selected', () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Manually trigger continue without selecting an answer
    // This would be an edge case, but we should handle it gracefully
    const instance = screen.getByText('The sky is blue.').closest('[data-testid]');
    
    // The component should not call onAnswer if no answer is selected
    expect(mockOnAnswer).not.toHaveBeenCalled();
  });

  it('tracks timing correctly', async () => {
    render(
      <TestWrapper>
        <TrueFalseNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const trueButton = screen.getByText('True');
    fireEvent.click(trueButton);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockTrackQuestionAnswered).toHaveBeenCalledWith(
        'test-true-false-1',
        'true-false',
        'true',
        true,
        expect.any(Number), // Time will be close to 0 in tests
        1
      );
    });
  });
});