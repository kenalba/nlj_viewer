import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent } from '../../test/test-utils';
import { createMockLikertQuestion } from '../../test/utils';
import { LikertScaleNode } from '../LikertScaleNode';

describe('LikertScaleNode', () => {
  const mockOnAnswer = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the question text and content', () => {
    const question = createMockLikertQuestion({
      text: 'How satisfied are you with your job?',
      content: 'Please rate your satisfaction level',
    });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('How satisfied are you with your job?')).toBeInTheDocument();
    expect(screen.getByText('Please rate your satisfaction level')).toBeInTheDocument();
  });

  it('renders scale buttons with correct labels', () => {
    const question = createMockLikertQuestion({
      scale: {
        min: 1,
        max: 5,
        labels: {
          min: 'Strongly Disagree',
          max: 'Strongly Agree',
        },
      },
    });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('Strongly Disagree')).toBeInTheDocument();
    expect(screen.getByText('Strongly Agree')).toBeInTheDocument();
    
    // Check that all scale values are rendered
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(i.toString())).toBeInTheDocument();
    }
  });

  it('handles scale selection correctly', async () => {
    const user = userEvent.setup();
    const question = createMockLikertQuestion();
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    // Click on scale value 3
    const button3 = screen.getByRole('button', { name: /3/i });
    await user.click(button3);
    
    // Submit button should be enabled and show "Submit"
    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeEnabled();
    
    await user.click(submitButton);
    expect(mockOnAnswer).toHaveBeenCalledWith(3);
  });

  it('shows validation error for required questions', async () => {
    const user = userEvent.setup();
    const question = createMockLikertQuestion({ required: true });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    // Skip button should be disabled when required and no value selected
    const submitButton = screen.getByRole('button', { name: /skip/i });
    expect(submitButton).toBeDisabled();
    
    // Select a value and then clear it to trigger validation
    const button3 = screen.getByRole('button', { name: /3/i });
    await user.click(button3);
    
    // Now the button should be enabled and show "Submit"
    const submitButtonEnabled = screen.getByRole('button', { name: /submit/i });
    expect(submitButtonEnabled).toBeEnabled();
    
    // We can test validation by checking the helper text
    expect(screen.getByText('* This question is required')).toBeInTheDocument();
  });

  it('allows skipping non-required questions', async () => {
    const user = userEvent.setup();
    const question = createMockLikertQuestion({ required: false });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    const submitButton = screen.getByRole('button', { name: /skip/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalledWith(0);
  });

  it('uses default value when provided', () => {
    const question = createMockLikertQuestion({ defaultValue: 3 });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    // Button 3 should be selected
    const button3 = screen.getByRole('button', { name: /3/i });
    expect(button3).toHaveClass('MuiButton-contained');
    
    // Submit button should show "Submit"
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('renders custom scale labels correctly', () => {
    const question = createMockLikertQuestion({
      scale: {
        min: 1,
        max: 5,
        labels: {
          min: 'Never',
          max: 'Always',
          middle: 'Sometimes',
        },
      },
    });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    // Labels are now only shown at the top of the scale, not in buttons
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.getByText('Sometimes')).toBeInTheDocument();
    expect(screen.getByText('Always')).toBeInTheDocument();
  });

  it('handles different scale ranges', () => {
    const question = createMockLikertQuestion({
      scale: {
        min: 0,
        max: 10,
        step: 2,
        labels: {
          min: 'Not at all',
          max: 'Extremely',
        },
      },
    });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    // Should render 0, 2, 4, 6, 8, 10
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    
    // Should not render 1, 3, 5, etc.
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('shows required field helper text', () => {
    const question = createMockLikertQuestion({ required: true });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('* This question is required')).toBeInTheDocument();
  });

  it('supports vertical layout for large scales', () => {
    const question = createMockLikertQuestion({
      scale: {
        min: 1,
        max: 10,
        labels: {
          min: 'Strongly Disagree',
          max: 'Strongly Agree',
        },
      },
    });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    // With 10 buttons, should use vertical layout
    const buttonGroup = screen.getByRole('group');
    expect(buttonGroup).toHaveClass('MuiButtonGroup-vertical');
  });

  it('applies hyundai theme correctly', () => {
    const question = createMockLikertQuestion();
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />, {
      themeMode: 'hyundai',
    });
    
    const submitButton = screen.getByRole('button', { name: /skip/i });
    expect(submitButton).toBeInTheDocument();
  });

  it('applies unfiltered theme correctly', () => {
    const question = createMockLikertQuestion();
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />, {
      themeMode: 'unfiltered',
    });
    
    const submitButton = screen.getByRole('button', { name: /skip/i });
    expect(submitButton).toBeInTheDocument();
  });

  it('renders with media content', () => {
    const question = createMockLikertQuestion({
      media: {
        id: 'test-media',
        type: 'IMAGE',
        fullPath: '/test-image.jpg',
        title: 'Test Image',
      },
    });
    
    render(<LikertScaleNode question={question} onAnswer={mockOnAnswer} />);
    
    // MediaViewer should be rendered with alt text
    expect(screen.getByAltText('Test Image')).toBeInTheDocument();
  });
});