import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, createMockMatrixQuestion } from '../../test/utils';
import { MatrixNode } from '../MatrixNode';

describe('MatrixNode', () => {
  const mockOnAnswer = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the question text and content', () => {
    const question = createMockMatrixQuestion({
      text: 'Please rate the following aspects of your job',
      content: 'Select one option for each row',
    });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('Please rate the following aspects of your job')).toBeInTheDocument();
    expect(screen.getByText('Select one option for each row')).toBeInTheDocument();
  });

  it('renders matrix table on desktop', () => {
    const question = createMockMatrixQuestion();
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    // Should render table headers
    expect(screen.getByText('Poor')).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    
    // Should render row labels
    expect(screen.getByText('Job Satisfaction')).toBeInTheDocument();
    expect(screen.getByText('Growth Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Management Support')).toBeInTheDocument();
  });

  it('handles single select responses', async () => {
    const user = userEvent.setup();
    const question = createMockMatrixQuestion({
      matrixType: 'single',
    });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    // Select "Good" for "Job Satisfaction"
    const radios = screen.getAllByRole('radio');
    const satisfactionGoodRadio = radios.find(radio => {
      const row = radio.closest('tr');
      return row?.textContent?.includes('Job Satisfaction') && 
             row?.textContent?.includes('Good');
    });
    
    if (satisfactionGoodRadio) {
      await user.click(satisfactionGoodRadio);
    }
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalledWith({
      satisfaction: 'good',
    });
  });

  it('handles multiple select responses', async () => {
    const user = userEvent.setup();
    const question = createMockMatrixQuestion({
      matrixType: 'multiple',
    });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    // Select multiple options for "Job Satisfaction"
    const checkboxes = screen.getAllByRole('checkbox');
    const satisfactionCheckboxes = checkboxes.filter(checkbox => {
      const row = checkbox.closest('tr');
      return row?.textContent?.includes('Job Satisfaction');
    });
    
    if (satisfactionCheckboxes.length >= 2) {
      await user.click(satisfactionCheckboxes[0]); // Poor
      await user.click(satisfactionCheckboxes[1]); // Fair
    }
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalledWith({
      satisfaction: ['poor', 'fair'],
    });
  });

  it('shows validation error for required rows', async () => {
    const user = userEvent.setup();
    const question = createMockMatrixQuestion({
      required: true,
    });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    // Don't select anything, just submit
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(screen.getByText(/Please provide a response for/)).toBeInTheDocument();
    expect(mockOnAnswer).not.toHaveBeenCalled();
  });

  it('handles individual row requirements', async () => {
    const user = userEvent.setup();
    const question = createMockMatrixQuestion({
      rows: [
        { id: 'satisfaction', text: 'Job Satisfaction', required: true },
        { id: 'growth', text: 'Growth Opportunities', required: false },
        { id: 'support', text: 'Management Support', required: true },
      ],
    });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    // Only select for one required row
    const radios = screen.getAllByRole('radio');
    const satisfactionRadio = radios.find(radio => {
      const row = radio.closest('tr');
      return row?.textContent?.includes('Job Satisfaction') && 
             row?.textContent?.includes('Good');
    });
    
    if (satisfactionRadio) {
      await user.click(satisfactionRadio);
    }
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    // Should show error for missing required row
    expect(screen.getByText('Please provide a response for "Management Support".')).toBeInTheDocument();
    expect(mockOnAnswer).not.toHaveBeenCalled();
  });

  it('shows required asterisks for required rows', () => {
    const question = createMockMatrixQuestion({
      rows: [
        { id: 'satisfaction', text: 'Job Satisfaction', required: true },
        { id: 'growth', text: 'Growth Opportunities', required: false },
      ],
    });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    // Required row should have asterisk
    const satisfactionRow = screen.getByText('Job Satisfaction').closest('tr');
    expect(satisfactionRow).toHaveTextContent('*');
    
    // Non-required row should not have asterisk
    const growthRow = screen.getByText('Growth Opportunities').closest('tr');
    expect(growthRow).not.toHaveTextContent('*');
  });

  it('handles column descriptions', () => {
    const question = createMockMatrixQuestion({
      columns: [
        { id: 'poor', text: 'Poor', description: 'Very unsatisfactory' },
        { id: 'fair', text: 'Fair', description: 'Somewhat satisfactory' },
        { id: 'good', text: 'Good', description: 'Satisfactory' },
        { id: 'excellent', text: 'Excellent', description: 'Very satisfactory' },
      ],
    });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('Poor')).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('shows required field helper text', () => {
    const question = createMockMatrixQuestion({ required: true });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('* Required questions are marked with an asterisk')).toBeInTheDocument();
  });

  it('applies theme correctly', () => {
    const question = createMockMatrixQuestion();
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />, {
      themeMode: 'unfiltered',
    });
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeInTheDocument();
  });

  it('handles empty responses correctly', async () => {
    const user = userEvent.setup();
    const question = createMockMatrixQuestion({ required: false });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalledWith({});
  });

  it('maintains separate responses for each row', async () => {
    const user = userEvent.setup();
    const question = createMockMatrixQuestion({
      matrixType: 'single',
    });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    // Select different options for different rows
    const radios = screen.getAllByRole('radio');
    
    // Find and click "Good" for "Job Satisfaction"
    const satisfactionGoodRadio = radios.find(radio => {
      const row = radio.closest('tr');
      return row?.textContent?.includes('Job Satisfaction') && 
             row?.textContent?.includes('Good');
    });
    
    // Find and click "Excellent" for "Growth Opportunities"
    const growthExcellentRadio = radios.find(radio => {
      const row = radio.closest('tr');
      return row?.textContent?.includes('Growth Opportunities') && 
             row?.textContent?.includes('Excellent');
    });
    
    if (satisfactionGoodRadio) {
      await user.click(satisfactionGoodRadio);
    }
    
    if (growthExcellentRadio) {
      await user.click(growthExcellentRadio);
    }
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalledWith({
      satisfaction: 'good',
      growth: 'excellent',
    });
  });

  it('renders with media content', () => {
    const question = createMockMatrixQuestion({
      media: {
        id: 'test-media',
        type: 'IMAGE',
        fullPath: '/test-image.jpg',
        title: 'Test Image',
      },
    });
    
    render(<MatrixNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('Test Image')).toBeInTheDocument();
  });

  // Note: Mobile responsive tests would require mocking useMediaQuery
  // and testing the card layout vs table layout
});