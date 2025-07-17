import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GameView } from '../GameView';
import { hyundaiTheme } from '../../theme/hyundaiTheme';
import { unfilteredTheme } from '../../theme/unfilteredTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import type { NLJScenario } from '../../types/nlj';

// Mock the audio context
const mockPlaySound = vi.fn();
vi.mock('../../contexts/AudioContext', () => ({
  useAudio: () => ({
    playSound: mockPlaySound,
  }),
}));

// Mock the xAPI context
const mockTrackActivityLaunched = vi.fn();
const mockTrackActivityCompleted = vi.fn();
const mockTrackQuestionAnswered = vi.fn();
vi.mock('../../contexts/XAPIContext', () => ({
  useXAPI: () => ({
    trackActivityLaunched: mockTrackActivityLaunched,
    trackActivityCompleted: mockTrackActivityCompleted,
    trackQuestionAnswered: mockTrackQuestionAnswered,
  }),
}));

// Mock the GameContext
const mockState = {
  currentNodeId: 'start-node',
  scenarioId: 'test-scenario',
  variables: {},
  completed: false,
};
const mockNavigateToNode = vi.fn();
const mockReset = vi.fn();
vi.mock('../../contexts/GameContext', () => ({
  useGameContext: () => ({
    state: mockState,
    navigateToNode: mockNavigateToNode,
    reset: mockReset,
  }),
}));

// Mock the ThemeContext
const mockToggleTheme = vi.fn();
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    themeMode: 'hyundai',
    toggleTheme: mockToggleTheme,
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock the NodeRenderer component
vi.mock('../NodeRenderer', () => ({
  NodeRenderer: ({ node }: { node: { type: string; text?: string } }) => (
    <div data-testid="node-renderer">
      <div data-testid="node-type">{node.type}</div>
      {node.text && <div data-testid="node-text">{node.text}</div>}
    </div>
  ),
}));

// Mock the CardTransition component
vi.mock('../CardTransition', () => ({
  CardTransition: ({ children, nodeId }: { children: React.ReactNode; nodeId: string }) => (
    <div data-testid="card-transition" data-node-id={nodeId}>
      {children}
    </div>
  ),
}));

// Mock the ThemeToggle component
vi.mock('../ThemeToggle', () => ({
  ThemeToggle: () => (
    <div data-testid="theme-toggle">Theme Toggle</div>
  ),
}));

// Mock the SoundToggle component
vi.mock('../SoundToggle', () => ({
  SoundToggle: () => (
    <div data-testid="sound-toggle">Sound Toggle</div>
  ),
}));

// Mock scenario utils
vi.mock('../../utils/scenarioUtils', () => ({
  findNodeById: vi.fn((scenario: any, nodeId: string) => {
    return scenario.nodes.find((node: any) => node.id === nodeId) || null;
  }),
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; theme?: 'hyundai' | 'unfiltered' }> = ({ 
  children, 
  theme = 'hyundai' 
}) => (
  <MuiThemeProvider theme={theme === 'hyundai' ? hyundaiTheme : unfilteredTheme}>
    {children}
  </MuiThemeProvider>
);

// Mock scenario data
const mockScenario: NLJScenario = {
  id: 'test-scenario',
  name: 'Test Scenario',
  nodes: [
    {
      id: 'start-node',
      type: 'start',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    },
    {
      id: 'question-node',
      type: 'question',
      text: 'What is your name?',
      x: 200,
      y: 300,
      width: 300,
      height: 200,
    },
    {
      id: 'end-node',
      type: 'end',
      x: 300,
      y: 500,
      width: 300,
      height: 200,
    },
  ],
  links: [
    {
      id: 'link-1',
      type: 'link',
      sourceNodeId: 'start-node',
      targetNodeId: 'question-node',
      startPoint: { x: 100, y: 100 },
      endPoint: { x: 200, y: 200 },
    },
    {
      id: 'link-2',
      type: 'link',
      sourceNodeId: 'question-node',
      targetNodeId: 'end-node',
      startPoint: { x: 200, y: 200 },
      endPoint: { x: 300, y: 300 },
    },
  ],
  orientation: 'horizontal',
  activityType: 'training',
};

describe('GameView', () => {
  const mockOnHome = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.currentNodeId = 'start-node';
    mockState.scenarioId = 'test-scenario';
    mockState.completed = false;
  });

  it('renders correctly with scenario and current node', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Scenario')).toBeInTheDocument();
    expect(screen.getByTestId('node-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('node-type')).toHaveTextContent('start');
  });

  it('displays scenario name in app bar', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Scenario')).toBeInTheDocument();
  });

  it('renders home button and calls onHome when clicked', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    const homeButton = screen.getByTestId('HomeIcon').closest('button');
    expect(homeButton).toBeInTheDocument();

    fireEvent.click(homeButton!);
    expect(mockOnHome).toHaveBeenCalledTimes(1);
  });

  it('renders theme and sound toggles', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('sound-toggle')).toBeInTheDocument();
  });

  it('tracks activity launch on mount', async () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockTrackActivityLaunched).toHaveBeenCalledWith(mockScenario);
    });
  });

  it('tracks activity launch only once when scenario changes', async () => {
    const { rerender } = render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockTrackActivityLaunched).toHaveBeenCalledTimes(1);
    });

    // Rerender with same scenario - should not track again
    rerender(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(mockTrackActivityLaunched).toHaveBeenCalledTimes(1);

    // Rerender with different scenario - should track again
    const newScenario = { ...mockScenario, id: 'new-scenario' };
    rerender(
      <TestWrapper>
        <GameView scenario={newScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockTrackActivityLaunched).toHaveBeenCalledTimes(2);
    });
  });

  it('passes current node to NodeRenderer', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    // Verify the node content is rendered by the mocked NodeRenderer
    expect(screen.getByTestId('node-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('node-type')).toHaveTextContent('start');
  });

  it('renders node content correctly', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    // Verify the scenario is being used to render the node
    expect(screen.getByTestId('node-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('node-type')).toHaveTextContent('start');
  });

  it('updates rendered node when current node changes', () => {
    const { rerender } = render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    // Initially shows start node
    expect(screen.getByTestId('node-type')).toHaveTextContent('start');

    // Change current node
    mockState.currentNodeId = 'question-node';
    
    // Re-render to simulate state change
    rerender(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(screen.getByTestId('node-type')).toHaveTextContent('question');
    expect(screen.getByTestId('node-text')).toHaveTextContent('What is your name?');
  });

  it('uses CardTransition with correct nodeId', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    // Verify CardTransition is rendered with correct nodeId
    expect(screen.getByTestId('card-transition')).toHaveAttribute('data-node-id', 'start-node');
  });

  it('shows error message when node not found', () => {
    mockState.currentNodeId = 'non-existent-node';

    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(screen.getByText('Node not found: non-existent-node')).toBeInTheDocument();
    expect(screen.queryByTestId('node-renderer')).not.toBeInTheDocument();
  });

  it('renders with different themes', () => {
    const { rerender } = render(
      <TestWrapper theme="hyundai">
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Scenario')).toBeInTheDocument();

    rerender(
      <TestWrapper theme="unfiltered">
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Scenario')).toBeInTheDocument();
  });

  it('renders with responsive layout', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    // Check for layout structure
    expect(screen.getByText('Test Scenario')).toBeInTheDocument();
    
    // Verify the layout structure exists
    expect(screen.getByTestId('card-transition')).toBeInTheDocument();
    expect(screen.getByTestId('node-renderer')).toBeInTheDocument();
    
    // Check for responsive container
    const container = screen.getByTestId('card-transition').closest('.MuiContainer-root');
    expect(container).toBeInTheDocument();
  });

  it('handles scenario with no nodes gracefully', () => {
    const emptyScenario: NLJScenario = {
      ...mockScenario,
      nodes: [],
    };

    render(
      <TestWrapper>
        <GameView scenario={emptyScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(screen.getByText('Node not found: start-node')).toBeInTheDocument();
  });

  it('handles scenario completion state', () => {
    mockState.currentNodeId = 'end-node';
    mockState.completed = true;

    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    expect(screen.getByTestId('node-type')).toHaveTextContent('end');
  });

  it('renders AppBar with proper structure', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    // Check for AppBar elements
    expect(screen.getByTestId('HomeIcon').closest('button')).toBeInTheDocument();
    expect(screen.getByText('Test Scenario')).toBeInTheDocument();
    expect(screen.getByTestId('sound-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('maintains proper component hierarchy', () => {
    render(
      <TestWrapper>
        <GameView scenario={mockScenario} onHome={mockOnHome} />
      </TestWrapper>
    );

    // Verify the CardTransition wraps the NodeRenderer
    const cardTransition = screen.getByTestId('card-transition');
    const nodeRenderer = screen.getByTestId('node-renderer');
    
    expect(cardTransition).toContainElement(nodeRenderer);
  });
});