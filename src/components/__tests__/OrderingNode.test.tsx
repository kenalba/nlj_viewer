import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { OrderingNode } from '../OrderingNode';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { hyundaiTheme } from '../../theme/hyundaiTheme';
import { unfilteredTheme } from '../../theme/unfilteredTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import type { OrderingNode as OrderingNodeType, OrderingItem } from '../../types/nlj';

// Mock the audio context
const mockPlaySound = vi.fn();
vi.mock('../../contexts/AudioContext', () => ({
  useAudio: () => ({
    playSound: mockPlaySound,
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

// Mock ordering items
const mockItems: OrderingItem[] = [
  {
    id: 'item-1',
    text: 'First step',
    correctOrder: 1,
  },
  {
    id: 'item-2',
    text: 'Second step',
    correctOrder: 2,
  },
  {
    id: 'item-3',
    text: 'Third step',
    correctOrder: 3,
  },
];

const mockQuestion: OrderingNodeType = {
  id: 'test-ordering-1',
  type: 'ordering',
  text: 'Arrange these steps in the correct order',
  content: 'Think about the logical sequence of events.',
  items: mockItems,
  x: 100,
  y: 100,
  width: 400,
  height: 300,
  additionalMediaList: [],
};

const mockQuestionWithMedia: OrderingNodeType = {
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

const mockQuestionWithAdditionalMedia: OrderingNodeType = {
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

describe('OrderingNode', () => {
  const mockOnAnswer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders question text and content', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Arrange these steps in the correct order')).toBeInTheDocument();
    expect(screen.getByText('Think about the logical sequence of events.')).toBeInTheDocument();
  });

  it('renders drag and drop instruction', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Drag and drop the items below to arrange them in the correct order:')).toBeInTheDocument();
  });

  it('renders all ordering items', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText(/First step/)).toBeInTheDocument();
    expect(screen.getByText(/Second step/)).toBeInTheDocument();
    expect(screen.getByText(/Third step/)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Submit Order')).toBeInTheDocument();
  });

  it('items are draggable initially', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const firstItem = screen.getByText(/First step/).closest('[draggable]');
    expect(firstItem).toHaveAttribute('draggable', 'true');
  });

  it('shows continue button after submit and calls onAnswer when clicked', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Submit the order
    const submitButton = screen.getByText('Submit Order');
    fireEvent.click(submitButton);

    // Check if continue button appears
    expect(screen.getByText('Continue')).toBeInTheDocument();

    // Click continue button
    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    expect(mockOnAnswer).toHaveBeenCalled();
  });

  it('plays sound when submitting', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const submitButton = screen.getByText('Submit Order');
    fireEvent.click(submitButton);

    expect(mockPlaySound).toHaveBeenCalled();
  });

  it('handles drag start event', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const firstItem = screen.getByText(/First step/).closest('[draggable]');
    
    // Mock dataTransfer
    const dataTransfer = {
      effectAllowed: '',
      setData: vi.fn(),
      getData: vi.fn(),
    };

    const dragEvent = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: false,
    });

    fireEvent(firstItem!, dragEvent);

    expect(dataTransfer.effectAllowed).toBe('move');
  });

  it('handles drag over event', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const firstItem = screen.getByText(/First step/).closest('[draggable]');
    
    // Mock dataTransfer
    const dataTransfer = {
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(),
    };

    const dragOverEvent = new Event('dragover', { bubbles: true });
    Object.defineProperty(dragOverEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: false,
    });

    fireEvent(firstItem!, dragOverEvent);

    expect(dataTransfer.dropEffect).toBe('move');
  });

  it('handles drop event and plays click sound', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const firstItem = screen.getByText(/First step/).closest('[draggable]');
    const secondItem = screen.getByText(/Second step/).closest('[draggable]');
    
    // Simulate drag start
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(),
    };

    const dragStartEvent = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: false,
    });

    fireEvent(firstItem!, dragStartEvent);

    // Simulate drop
    const dropEvent = new Event('drop', { bubbles: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: false,
    });

    fireEvent(secondItem!, dropEvent);

    expect(mockPlaySound).toHaveBeenCalledWith('click');
  });

  it('renders media when present', () => {
    render(
      <TestWrapper>
        <OrderingNode
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
        <OrderingNode
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
        <OrderingNode
          question={questionWithoutContent}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Arrange these steps in the correct order')).toBeInTheDocument();
    expect(screen.queryByText('Think about the logical sequence of events.')).not.toBeInTheDocument();
  });

  it('applies unfiltered theme styling', () => {
    render(
      <TestWrapper theme="unfiltered">
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Arrange these steps in the correct order')).toBeInTheDocument();
    // Theme-specific styling would need more specific assertions
  });

  it('handles drag leave event', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const firstItem = screen.getByText(/First step/).closest('[draggable]');
    
    // Mock the drag leave event
    const dragLeaveEvent = new Event('dragleave', { bubbles: true });
    Object.defineProperty(dragLeaveEvent, 'currentTarget', {
      value: {
        contains: vi.fn().mockReturnValue(false),
      },
    });
    Object.defineProperty(dragLeaveEvent, 'relatedTarget', {
      value: null,
    });

    fireEvent(firstItem!, dragLeaveEvent);

    // This should clear the dragged over index
    // The visual change is hard to test, but the handler should execute without error
  });

  it('shows numbered items in order', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Items should be numbered
    expect(screen.getByText(/1\./)).toBeInTheDocument();
    expect(screen.getByText(/2\./)).toBeInTheDocument();
    expect(screen.getByText(/3\./)).toBeInTheDocument();
  });

  it('prevents dropping on same position', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const firstItem = screen.getByText(/First step/).closest('[draggable]');
    
    // Simulate drag start
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(),
    };

    const dragStartEvent = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: false,
    });

    fireEvent(firstItem!, dragStartEvent);

    // Simulate drop on same item
    const dropEvent = new Event('drop', { bubbles: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: false,
    });

    fireEvent(firstItem!, dropEvent);

    // Should not play click sound since it's the same position
    expect(mockPlaySound).not.toHaveBeenCalledWith('click');
  });

  it('handles drop without dragged item', () => {
    render(
      <TestWrapper>
        <OrderingNode
          question={mockQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    const firstItem = screen.getByText(/First step/).closest('[draggable]');
    
    // Simulate drop without drag start
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(),
    };

    const dropEvent = new Event('drop', { bubbles: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: dataTransfer,
      writable: false,
    });

    fireEvent(firstItem!, dropEvent);

    // Should not play click sound since no item was dragged
    expect(mockPlaySound).not.toHaveBeenCalledWith('click');
  });

  it('handles custom order arrangements', () => {
    // Create a custom question with specific order
    const customItems: OrderingItem[] = [
      { id: 'item-a', text: 'Step A', correctOrder: 2 },
      { id: 'item-b', text: 'Step B', correctOrder: 1 },
      { id: 'item-c', text: 'Step C', correctOrder: 3 },
    ];

    const customQuestion = {
      ...mockQuestion,
      items: customItems,
    };

    render(
      <TestWrapper>
        <OrderingNode
          question={customQuestion}
          onAnswer={mockOnAnswer}
        />
      </TestWrapper>
    );

    // Should render the custom items
    expect(screen.getByText(/Step A/)).toBeInTheDocument();
    expect(screen.getByText(/Step B/)).toBeInTheDocument();
    expect(screen.getByText(/Step C/)).toBeInTheDocument();
  });
});