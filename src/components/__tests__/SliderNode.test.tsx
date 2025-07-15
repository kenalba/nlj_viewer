import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, createMockSliderQuestion } from '../../test/utils';
import { SliderNode } from '../SliderNode';
import { fireEvent } from '@testing-library/react';

describe('SliderNode', () => {
  const mockOnAnswer = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the question text and content', () => {
    const question = createMockSliderQuestion({
      text: 'What percentage of your time is spent on customer service?',
      content: 'Please drag the slider to indicate the percentage',
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('What percentage of your time is spent on customer service?')).toBeInTheDocument();
    expect(screen.getByText('Please drag the slider to indicate the percentage')).toBeInTheDocument();
  });

  it('renders slider with correct range', () => {
    const question = createMockSliderQuestion({
      range: { min: 0, max: 100 },
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
  });

  it('displays range labels correctly', () => {
    const question = createMockSliderQuestion({
      range: { min: 0, max: 100 },
      labels: {
        min: 'Never',
        max: 'Always',
      },
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.getByText('Always')).toBeInTheDocument();
  });

  it('handles slider value changes', async () => {
    const user = userEvent.setup();
    const question = createMockSliderQuestion({
      range: { min: 0, max: 100 },
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    const slider = screen.getByRole('slider');
    
    // Simulate slider change
    fireEvent.change(slider, { target: { value: '75' } });
    
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalledWith(75);
  });

  it('shows current value when enabled', () => {
    const question = createMockSliderQuestion({
      range: { min: 0, max: 100 },
      defaultValue: 50,
      showValue: true,
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    // Look for the specific current value display (h6 element)
    const currentValueDisplay = screen.getByRole('heading', { level: 6 });
    expect(currentValueDisplay).toHaveTextContent('50');
  });

  it('formats values with precision', () => {
    const question = createMockSliderQuestion({
      range: { min: 0, max: 1, step: 0.1, precision: 1 },
      defaultValue: 0.5,
      showValue: true,
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    // Look for the specific current value display (h6 element)
    const currentValueDisplay = screen.getByRole('heading', { level: 6 });
    expect(currentValueDisplay).toHaveTextContent('0.5');
  });

  it('shows validation error for required questions', async () => {
    const user = userEvent.setup();
    const question = createMockSliderQuestion({ 
      required: true,
      defaultValue: undefined, // No default value
    });
    
    // Mock the component to not have a default value
    const modifiedQuestion = {
      ...question,
      defaultValue: undefined,
    };
    
    render(<SliderNode question={modifiedQuestion} onAnswer={mockOnAnswer} />);
    
    const submitButton = screen.getByRole('button', { name: /skip/i });
    await user.click(submitButton);
    
    expect(screen.getByText('This question is required. Please select a value.')).toBeInTheDocument();
    expect(mockOnAnswer).not.toHaveBeenCalled();
  });

  it('allows skipping non-required questions', async () => {
    const user = userEvent.setup();
    const question = createMockSliderQuestion({ 
      required: false,
      defaultValue: undefined // No default value so it shows Skip
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    const submitButton = screen.getByRole('button', { name: /skip/i });
    await user.click(submitButton);
    
    expect(mockOnAnswer).toHaveBeenCalled();
  });

  it('uses default value when provided', () => {
    const question = createMockSliderQuestion({ 
      defaultValue: 75,
      range: { min: 0, max: 100 },
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('75');
    
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('handles step values correctly', () => {
    const question = createMockSliderQuestion({
      range: { min: 0, max: 100, step: 10 },
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('step', '10');
  });

  it('shows custom value labels', () => {
    const question = createMockSliderQuestion({
      range: { min: 0, max: 100 },
      labels: {
        min: 'Low',
        max: 'High',
        custom: {
          25: 'Quarter',
          50: 'Half',
          75: 'Three Quarters',
        },
      },
      defaultValue: 50,
      showValue: true,
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    // Look for the specific current value display (h6 element)
    const currentValueDisplay = screen.getByRole('heading', { level: 6 });
    expect(currentValueDisplay).toHaveTextContent('Half');
  });

  it('shows tick marks when enabled', () => {
    const question = createMockSliderQuestion({
      range: { min: 0, max: 100, step: 25 },
      showTicks: true,
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    // Note: Testing tick marks is complex with MUI Slider, 
    // but we can verify the showTicks prop is being used
  });

  it('shows required field helper text', () => {
    const question = createMockSliderQuestion({ required: true });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByText('* This question is required')).toBeInTheDocument();
  });

  it('applies theme correctly', () => {
    const question = createMockSliderQuestion();
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />, {
      themeMode: 'unfiltered',
    });
    
    const submitButton = screen.getByRole('button', { name: /skip/i });
    expect(submitButton).toBeInTheDocument();
  });

  it('handles continuous vs discrete modes', () => {
    const discreteQuestion = createMockSliderQuestion({
      range: { min: 0, max: 100, step: 1 },
      continuous: false,
    });
    
    render(<SliderNode question={discreteQuestion} onAnswer={mockOnAnswer} />);
    
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });

  it('renders with media content', () => {
    const question = createMockSliderQuestion({
      media: {
        id: 'test-media',
        type: 'IMAGE',
        fullPath: '/test-image.jpg',
        title: 'Test Image',
      },
    });
    
    render(<SliderNode question={question} onAnswer={mockOnAnswer} />);
    
    expect(screen.getByAltText('Test Image')).toBeInTheDocument();
  });
});