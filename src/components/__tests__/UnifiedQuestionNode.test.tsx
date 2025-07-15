import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UnifiedQuestionNode } from '../UnifiedQuestionNode';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { hyundaiTheme } from '../../theme/hyundaiTheme';
import { unfilteredTheme } from '../../theme/unfilteredTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import type { QuestionNode, ChoiceNode } from '../../types/nlj';

// Mock the XAPI context
const mockTrackQuestionAnswered = vi.fn();

// Mock the useXAPI hook
vi.mock('../../contexts/XAPIContext', () => ({
  useXAPI: () => ({
    trackQuestionAnswered: mockTrackQuestionAnswered,
    trackActivityStarted: vi.fn(),
    trackActivityCompleted: vi.fn(),
    trackActivityTerminated: vi.fn(),
    trackActivitySuspended: vi.fn(),
    trackActivityResumed: vi.fn(),
    trackActivityExperienced: vi.fn(),
    getStatements: vi.fn().mockReturnValue([]),
    clearStatements: vi.fn(),
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

// Mock question and choices data
const mockQuestion: QuestionNode = {
  id: 'test-question-1',
  type: 'question',
  text: 'What is your favorite color?',
  content: 'Please select one of the following options',
  x: 100,
  y: 100,
  width: 400,
  height: 200,
  additionalMediaList: [],
};

const mockChoices: ChoiceNode[] = [
  {
    id: 'choice-1',
    type: 'choice',
    parentId: 'test-question-1',
    text: 'Red',
    value: 1,
    feedback: 'Great choice! Red is a vibrant color.',
    isCorrect: true,
    choiceType: 'CORRECT',
    x: 100,
    y: 300,
    width: 200,
    height: 100,
  },
  {
    id: 'choice-2',
    type: 'choice',
    parentId: 'test-question-1',
    text: 'Blue',
    value: 2,
    feedback: 'Not quite right, but blue is also nice.',
    isCorrect: false,
    choiceType: 'INCORRECT',
    x: 320,
    y: 300,
    width: 200,
    height: 100,
  },
  {
    id: 'choice-3',
    type: 'choice',
    parentId: 'test-question-1',
    text: 'Green',
    value: 3,
    feedback: 'This is a neutral choice.',
    isCorrect: false,
    choiceType: 'NEUTRAL',
    x: 540,
    y: 300,
    width: 200,
    height: 100,
  },
];

describe('UnifiedQuestionNode', () => {
  const mockOnChoiceSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders question text and content', () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    expect(screen.getByText('Please select one of the following options')).toBeInTheDocument();
  });

  it('renders all choice options', () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Green')).toBeInTheDocument();
  });

  it('handles choice selection', () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    // Check that the first radio button is selected
    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons[0]).toBeChecked();
  });

  it('enables submit button when choice is selected', () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const submitButton = screen.getByText('Submit Answer');
    expect(submitButton).toBeDisabled();

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    expect(submitButton).not.toBeDisabled();
  });

  it('shows feedback after submitting answer', async () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Great choice! Red is a vibrant color.')).toBeInTheDocument();
    });
  });

  it('shows continue button after feedback is displayed', async () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });
  });

  it('calls onChoiceSelect when continue button is clicked', async () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    expect(mockOnChoiceSelect).toHaveBeenCalledWith(mockChoices[0]);
  });

  it('tracks question answered with xAPI', async () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockTrackQuestionAnswered).toHaveBeenCalledWith(
        'test-question-1',
        'multiple-choice',
        'Red',
        true,
        expect.any(Number),
        1
      );
    });
  });

  it('disables interaction when disabled prop is true', () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
          disabled={true}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons[0]).not.toBeChecked();
    expect(radioButtons[0]).toBeDisabled();
  });

  it('prevents interaction after feedback is shown', async () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Great choice! Red is a vibrant color.')).toBeInTheDocument();
    });

    // Try to click another choice after feedback is shown
    const blueChoice = screen.getByText('Blue');
    fireEvent.click(blueChoice);

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons[1]).not.toBeChecked();
  });

  it('renders media when present', () => {
    const questionWithMedia: QuestionNode = {
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

    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={questionWithMedia}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    expect(screen.getByAltText('Question: What is your favorite color?')).toBeInTheDocument();
  });

  it('renders additional media when present', () => {
    const questionWithAdditionalMedia: QuestionNode = {
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

    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={questionWithAdditionalMedia}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    expect(screen.getByAltText('Additional media 1')).toBeInTheDocument();
  });

  it('handles keyboard navigation with number keys', () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    // Press '1' to select first choice
    fireEvent.keyDown(document, { key: '1' });

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons[0]).toBeChecked();

    // Press '2' to select second choice
    fireEvent.keyDown(document, { key: '2' });

    expect(radioButtons[1]).toBeChecked();
  });

  it('handles Enter key to submit answer', async () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    fireEvent.keyDown(document, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Great choice! Red is a vibrant color.')).toBeInTheDocument();
    });
  });

  it('handles Enter key to continue after feedback', async () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(mockOnChoiceSelect).toHaveBeenCalledWith(mockChoices[0]);
  });

  it('resets state when question changes', () => {
    const { rerender } = render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons[0]).toBeChecked();

    // Change question
    const newQuestion = { ...mockQuestion, id: 'new-question', text: 'New question?' };
    rerender(
      <TestWrapper>
        <UnifiedQuestionNode
          question={newQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const resetRadioButtons = screen.getAllByRole('radio');
    expect(resetRadioButtons[0]).not.toBeChecked();
  });

  it('applies unfiltered theme styling', () => {
    render(
      <TestWrapper theme="unfiltered">
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    // Theme-specific styling would need more specific assertions
  });

  it('shows keyboard controls helper text', () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    expect(screen.getByText(/Use number keys \(1-3\) to select • Enter to submit/)).toBeInTheDocument();
  });

  it('hides keyboard controls helper when feedback is shown', async () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText(/Use number keys/)).not.toBeInTheDocument();
    });
  });

  it('shows correct feedback severity for different choice types', async () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    // Test correct choice (should show success)
    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Great choice! Red is a vibrant color.')).toBeInTheDocument();
    });
  });

  it('ignores number keys beyond available choices', () => {
    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    // Press '5' which is beyond our 3 choices
    fireEvent.keyDown(document, { key: '5' });

    const radios = screen.getAllByRole('radio');
    radios.forEach(radio => {
      expect(radio).not.toBeChecked();
    });
  });

  it('handles choice selection when no feedback is provided', async () => {
    const choicesWithoutFeedback = mockChoices.map(choice => ({
      ...choice,
      feedback: undefined,
    }));

    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={mockQuestion}
          choices={choicesWithoutFeedback}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    const redChoice = screen.getByText('Red');
    fireEvent.click(redChoice);

    const submitButton = screen.getByText('Submit Answer');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Thank you for your response.')).toBeInTheDocument();
    });
  });

  it('renders question without content', () => {
    const questionWithoutContent = {
      ...mockQuestion,
      content: undefined,
    };

    render(
      <TestWrapper>
        <UnifiedQuestionNode
          question={questionWithoutContent}
          choices={mockChoices}
          onChoiceSelect={mockOnChoiceSelect}
        />
      </TestWrapper>
    );

    expect(screen.getByText('What is your favorite color?')).toBeInTheDocument();
    expect(screen.queryByText('Please select one of the following options')).not.toBeInTheDocument();
  });
});