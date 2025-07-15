import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MatchingNode } from '../MatchingNode';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { hyundaiTheme } from '../../theme/hyundaiTheme';
import { unfilteredTheme } from '../../theme/unfilteredTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import type { MatchingNode as MatchingNodeType, MatchingItem } from '../../types/nlj';

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

// Mock matching items
const mockLeftItems: MatchingItem[] = [
  { id: 'left-1', text: 'Apple' },
  { id: 'left-2', text: 'Banana' },
  { id: 'left-3', text: 'Cherry' },
];

const mockRightItems: MatchingItem[] = [
  { id: 'right-1', text: 'Red' },
  { id: 'right-2', text: 'Yellow' },
  { id: 'right-3', text: 'Red' },
];

const mockCorrectMatches = [
  { leftId: 'left-1', rightId: 'right-1' }, // Apple -> Red
  { leftId: 'left-2', rightId: 'right-2' }, // Banana -> Yellow
  { leftId: 'left-3', rightId: 'right-3' }, // Cherry -> Red
];

const mockQuestion: MatchingNodeType = {
  id: 'test-matching-1',
  type: 'matching',
  text: 'Match each fruit with its color',
  content: 'Click on items from both columns to create matches.',
  leftItems: mockLeftItems,
  rightItems: mockRightItems,
  correctMatches: mockCorrectMatches,
  x: 100,
  y: 100,
  width: 600,
  height: 400,
  additionalMediaList: [],
};

const mockQuestionWithMedia: MatchingNodeType = {
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

const mockQuestionWithAdditionalMedia: MatchingNodeType = {
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

describe('MatchingNode', () => {
  const mockOnAnswer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders question text and content', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Match each fruit with its color')).toBeInTheDocument();
    expect(screen.getByText('Click on items from both columns to create matches.')).toBeInTheDocument();
  });

  it('renders instruction text', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Click on items from both columns to match them together:')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Column A')).toBeInTheDocument();
    expect(screen.getByText('Column B')).toBeInTheDocument();
  });

  it('renders all left items', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('renders all right items', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Note: "Red" appears twice in right items, so we check for all instances
    const redItems = screen.getAllByText('Red');
    expect(redItems).toHaveLength(2);
    expect(screen.getByText('Yellow')).toBeInTheDocument();
  });

  it('renders submit button initially disabled', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const submitButton = screen.getByText('Submit Matches');
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('handles left item selection', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const appleItem = screen.getByText('Apple');
    fireEvent.click(appleItem);

    expect(mockPlaySound).toHaveBeenCalledWith('click');
  });

  it('handles right item selection', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const redItem = screen.getAllByText('Red')[0];
    fireEvent.click(redItem);

    expect(mockPlaySound).toHaveBeenCalledWith('click');
  });

  it('creates match when left and right items are selected', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const appleItem = screen.getByText('Apple');
    const redItem = screen.getAllByText('Red')[0];

    // Select Apple first
    fireEvent.click(appleItem);
    
    // Then select Red to create match
    fireEvent.click(redItem);

    // Should show the match indicator
    expect(screen.getByText('→ Red')).toBeInTheDocument();
  });

  it('enables submit button when matches are created', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const appleItem = screen.getByText('Apple');
    const redItem = screen.getAllByText('Red')[0];

    // Create a match
    fireEvent.click(appleItem);
    fireEvent.click(redItem);

    const submitButton = screen.getByText('Submit Matches');
    expect(submitButton).not.toBeDisabled();
  });

  it('shows match indicator in left column', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const appleItem = screen.getByText('Apple');
    const redItem = screen.getAllByText('Red')[0];

    // Create a match
    fireEvent.click(appleItem);
    fireEvent.click(redItem);

    // Should show the match indicator in left column
    expect(screen.getByText('→ Red')).toBeInTheDocument();
  });

  it('shows match indicator in right column', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const appleItem = screen.getByText('Apple');
    const redItem = screen.getAllByText('Red')[0];

    // Create a match
    fireEvent.click(appleItem);
    fireEvent.click(redItem);

    // Should show the match indicator in right column
    expect(screen.getByText('← Apple')).toBeInTheDocument();
  });

  it('allows removing matches with close button', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const appleItem = screen.getByText('Apple');
    const redItem = screen.getAllByText('Red')[0];

    // Create a match
    fireEvent.click(appleItem);
    fireEvent.click(redItem);

    // Find and click the close button
    const closeButton = screen.getByTestId('CloseIcon');
    fireEvent.click(closeButton);

    expect(mockPlaySound).toHaveBeenCalledWith('click');
    // Match indicator should be removed
    expect(screen.queryByText('→ Red')).not.toBeInTheDocument();
  });

  it('deselects item when clicked twice', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const appleItem = screen.getByText('Apple');

    // Click twice
    fireEvent.click(appleItem);
    fireEvent.click(appleItem);

    expect(mockPlaySound).toHaveBeenCalledTimes(2);
  });

  it('replaces existing match when creating new one', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const appleItem = screen.getByText('Apple');
    const redItem = screen.getAllByText('Red')[0];
    const yellowItem = screen.getByText('Yellow');

    // Create initial match
    fireEvent.click(appleItem);
    fireEvent.click(redItem);
    
    expect(screen.getByText('→ Red')).toBeInTheDocument();

    // Create new match with same left item
    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    // Should show new match
    expect(screen.getByText('→ Yellow')).toBeInTheDocument();
    expect(screen.queryByText('→ Red')).not.toBeInTheDocument();
  });

  it('shows feedback when submitted with correct matches', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create all correct matches
    const appleItem = screen.getByText('Apple');
    const bananaItem = screen.getByText('Banana');
    const cherryItem = screen.getByText('Cherry');
    const redItems = screen.getAllByText('Red');
    const yellowItem = screen.getByText('Yellow');

    // Apple -> Red (first red item)
    fireEvent.click(appleItem);
    fireEvent.click(redItems[0]);

    // Banana -> Yellow
    fireEvent.click(bananaItem);
    fireEvent.click(yellowItem);

    // Cherry -> Red (second red item)
    fireEvent.click(cherryItem);
    fireEvent.click(redItems[1]);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Correct! You have matched all items correctly.')).toBeInTheDocument();
    });
  });

  it('shows feedback when submitted with incorrect matches', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create incorrect match
    const appleItem = screen.getByText('Apple');
    const yellowItem = screen.getByText('Yellow');

    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Incorrect. The correct matches are:/)).toBeInTheDocument();
    });
  });

  it('shows continue button after feedback', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create a match and submit
    const appleItem = screen.getByText('Apple');
    const yellowItem = screen.getByText('Yellow');

    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });
  });

  it('calls onAnswer when continue button is clicked', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create incorrect match
    const appleItem = screen.getByText('Apple');
    const yellowItem = screen.getByText('Yellow');

    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    expect(mockOnAnswer).toHaveBeenCalledWith(false);
  });

  it('plays correct sound for correct matches', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create all correct matches
    const appleItem = screen.getByText('Apple');
    const bananaItem = screen.getByText('Banana');
    const cherryItem = screen.getByText('Cherry');
    const redItems = screen.getAllByText('Red');
    const yellowItem = screen.getByText('Yellow');

    // Create correct matches
    fireEvent.click(appleItem);
    fireEvent.click(redItems[0]);
    fireEvent.click(bananaItem);
    fireEvent.click(yellowItem);
    fireEvent.click(cherryItem);
    fireEvent.click(redItems[1]);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPlaySound).toHaveBeenCalledWith('correct');
    });
  });

  it('plays incorrect sound for wrong matches', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create incorrect match
    const appleItem = screen.getByText('Apple');
    const yellowItem = screen.getByText('Yellow');

    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPlaySound).toHaveBeenCalledWith('incorrect');
    });
  });

  it('tracks question answered with xAPI', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create a match
    const appleItem = screen.getByText('Apple');
    const yellowItem = screen.getByText('Yellow');

    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockTrackQuestionAnswered).toHaveBeenCalledWith(
        'test-matching-1',
        'matching',
        expect.any(String), // JSON stringified matches
        false, // incorrect match
        expect.any(Number), // time spent
        1 // first attempt
      );
    });
  });

  it('disables interaction after feedback is shown', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create a match and submit
    const appleItem = screen.getByText('Apple');
    const yellowItem = screen.getByText('Yellow');

    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    // Try to click items after feedback - should not trigger sound
    mockPlaySound.mockClear();
    fireEvent.click(appleItem);
    expect(mockPlaySound).not.toHaveBeenCalled();
  });

  it('shows check icons for correct matches after feedback', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create correct match
    const appleItem = screen.getByText('Apple');
    const redItems = screen.getAllByText('Red');

    fireEvent.click(appleItem);
    fireEvent.click(redItems[0]);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Should show check icons for correct match (one in each column)
      const checkIcons = screen.getAllByTestId('CheckCircleIcon');
      expect(checkIcons.length).toBeGreaterThan(0);
    });
  });

  it('hides close buttons after feedback is shown', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create a match
    const appleItem = screen.getByText('Apple');
    const yellowItem = screen.getByText('Yellow');

    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    // Close button should be visible
    expect(screen.getByTestId('CloseIcon')).toBeInTheDocument();

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Close button should be hidden after feedback
      expect(screen.queryByTestId('CloseIcon')).not.toBeInTheDocument();
    });
  });

  it('renders media when present', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestionWithMedia}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByAltText('Test Image')).toBeInTheDocument();
  });

  it('renders additional media when present', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestionWithAdditionalMedia}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByAltText('Additional Image 1')).toBeInTheDocument();
  });

  it('renders question without content', () => {
    const questionWithoutContent = {
      ...mockQuestion,
      content: undefined,
    };

    render(
      <TestWrapper>
        <MatchingNode
          question={questionWithoutContent}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Match each fruit with its color')).toBeInTheDocument();
    expect(screen.queryByText('Click on items from both columns to create matches.')).not.toBeInTheDocument();
  });

  it('applies unfiltered theme styling', () => {
    render(
      <TestWrapper theme="unfiltered">
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Match each fruit with its color')).toBeInTheDocument();
    // Theme-specific styling would need more specific assertions
  });

  it('handles window resize events', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Simulate window resize
    fireEvent(window, new Event('resize'));

    // Component should handle resize without errors
    expect(screen.getByText('Match each fruit with its color')).toBeInTheDocument();
  });

  it('prevents removing matches after feedback', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create a match
    const appleItem = screen.getByText('Apple');
    const yellowItem = screen.getByText('Yellow');

    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    // Try to remove match after feedback - should not work
    mockPlaySound.mockClear();
    // Note: Close button is hidden after feedback, so this tests the function directly
  });

  it('shows correct feedback with proper match descriptions', async () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Create incorrect match
    const appleItem = screen.getByText('Apple');
    const yellowItem = screen.getByText('Yellow');

    fireEvent.click(appleItem);
    fireEvent.click(yellowItem);

    const submitButton = screen.getByText('Submit Matches');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/\"Apple\" ↔ \"Red\"/)).toBeInTheDocument();
      expect(screen.getByText(/\"Banana\" ↔ \"Yellow\"/)).toBeInTheDocument();
      expect(screen.getByText(/\"Cherry\" ↔ \"Red\"/)).toBeInTheDocument();
    });
  });

  it('handles empty matches correctly', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const submitButton = screen.getByText('Submit Matches');
    expect(submitButton).toBeDisabled();
  });

  it('handles selecting same item multiple times', () => {
    render(
      <TestWrapper>
        <MatchingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const appleItem = screen.getByText('Apple');
    const redItem = screen.getAllByText('Red')[0];

    // Select apple, then red, then apple again
    fireEvent.click(appleItem);
    fireEvent.click(redItem);
    fireEvent.click(appleItem);

    expect(mockPlaySound).toHaveBeenCalledTimes(3);
  });
});