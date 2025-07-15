import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, createMockTextAreaQuestion } from '../../test/utils';
import { TextAreaNode } from '../TextAreaNode';

describe('TextAreaNode', () => {
  const mockOnAnswer = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the question text and content', () => {
    const question = createMockTextAreaQuestion({
      text: 'Please describe your experience',
      content: 'Be as detailed as possible',
    });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('Please describe your experience')).toBeInTheDocument();
    expect(screen.getByText('Be as detailed as possible')).toBeInTheDocument();
  });

  it('renders textarea with placeholder', () => {
    const question = createMockTextAreaQuestion({
      placeholder: 'Type your response here...',
    });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByPlaceholderText('Type your response here...');
    expect(textarea).toBeInTheDocument();
  });

  it('handles text input correctly', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion();
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'This is my response');
    
    expect(textarea).toHaveValue('This is my response');
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalledWith('This is my response');
  });

  it('shows validation error for required questions', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion({ required: true });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const submitButton = screen.getByRole('button', { name: /skip/i });
    await user.click(submitButton);
    
    expect(screen.getByText('This question is required. Please enter a response.')).toBeInTheDocument();
    expect(mockOnAnswer).not.toHaveBeenCalled();
  });

  it('validates minimum length', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion({ 
      minLength: 10,
      required: true,
    });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Short'); // Only 5 characters
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(screen.getByText('Response must be at least 10 characters long.')).toBeInTheDocument();
    expect(mockOnAnswer).not.toHaveBeenCalled();
  });

  it('validates maximum length', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion({ 
      maxLength: 10,
      required: true,
    });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'This is a very long response that exceeds the limit');
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(screen.getByText('Response must not exceed 10 characters.')).toBeInTheDocument();
    expect(mockOnAnswer).not.toHaveBeenCalled();
  });

  it('allows skipping non-required questions', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion({ required: false });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const submitButton = screen.getByRole('button', { name: /skip/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalledWith('');
  });

  it('shows character count when maxLength is set', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion({ maxLength: 100 });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello');
    
    expect(screen.getByText('Characters: 5/100')).toBeInTheDocument();
  });

  it('shows word count when enabled', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion({ wordCount: true });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello world test');
    
    expect(screen.getByText('Words: 3')).toBeInTheDocument();
  });

  it('handles empty word count correctly', () => {
    const question = createMockTextAreaQuestion({ wordCount: true });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('Words: 0')).toBeInTheDocument();
  });

  it('shows warning color when approaching character limit', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion({ maxLength: 10 });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '123456789'); // 9 characters, 90% of limit
    
    const characterCount = screen.getByText('Characters: 9/10');
    expect(characterCount).toBeInTheDocument();
  });

  it('respects rows configuration', () => {
    const question = createMockTextAreaQuestion({ rows: 6 });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('rows', '6');
  });

  it('shows required field helper text', () => {
    const question = createMockTextAreaQuestion({ required: true });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('* This question is required')).toBeInTheDocument();
  });

  it('shows minimum length helper text', () => {
    const question = createMockTextAreaQuestion({ minLength: 20 });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('Minimum 20 characters required')).toBeInTheDocument();
  });

  it('applies theme correctly', () => {
    const question = createMockTextAreaQuestion();
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />, {
      themeMode: 'unfiltered',
    });
    
    const submitButton = screen.getByRole('button', { name: /skip/i });
    expect(submitButton).toBeInTheDocument();
  });

  it('handles spellcheck configuration', () => {
    const question = createMockTextAreaQuestion({ spellCheck: false });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('spellcheck', 'false');
  });

  it('trims whitespace on submission', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion();
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '   My response   ');
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalledWith('My response');
  });

  it('updates submit button text based on content', async () => {
    const user = userEvent.setup();
    const question = createMockTextAreaQuestion();
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    // Initially should show "Skip"
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Some text');
    
    // Should now show "Submit"
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('renders with media content', () => {
    const question = createMockTextAreaQuestion({
      media: {
        id: 'test-media',
        type: 'IMAGE',
        fullPath: '/test-image.jpg',
        title: 'Test Image',
      },
    });
    
    render(<TextAreaNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('Test Image')).toBeInTheDocument();
  });
});