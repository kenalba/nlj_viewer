import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FlowViewer } from '../FlowViewer';
import { ThemeProvider } from '../../../../contexts/ThemeContext';
import { hyundaiTheme } from '../../../../theme/hyundaiTheme';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import type { NLJScenario } from '../../../../types/nlj';

// Mock React Flow completely
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: any) => (
    <div data-testid="react-flow">
      Mock ReactFlow
      {children}
    </div>
  ),
  Controls: () => <div data-testid="flow-controls">Controls</div>,
  MiniMap: () => <div data-testid="flow-minimap">MiniMap</div>,
  Background: () => <div data-testid="flow-background">Background</div>,
  useNodesState: () => [[], vi.fn()],
  useEdgesState: () => [[], vi.fn()],
  addEdge: vi.fn(),
  ReactFlowProvider: ({ children }: any) => <div data-testid="react-flow-provider">{children}</div>,
  Panel: ({ children }: any) => <div data-testid="flow-panel">{children}</div>,
  useReactFlow: () => ({
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setViewport: vi.fn(),
    fitView: vi.fn(),
  }),
  MarkerType: { Arrow: 'arrow', ArrowClosed: 'arrowclosed' },
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Mock all Flow components
vi.mock('../FlowNode', () => ({
  FlowNode: () => <div data-testid="flow-node">FlowNode</div>,
}));

vi.mock('../FlowEdge', () => ({
  FlowEdge: () => <div data-testid="flow-edge">FlowEdge</div>,
}));

vi.mock('../NodeEditSidebar', () => ({
  NodeEditSidebar: () => <div data-testid="node-edit-sidebar">NodeEditSidebar</div>,
}));

vi.mock('../../utils/flowUtils', () => ({
  nljScenarioToFlow: () => ({ nodes: [], edges: [] }),
  flowToNljScenario: () => ({ nodes: [], links: [] }),
  NODE_TYPE_INFO: {},
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider initialTheme="hyundai">
    <MuiThemeProvider theme={hyundaiTheme}>
      {children}
    </MuiThemeProvider>
  </ThemeProvider>
);

// Mock scenario data
const mockScenario: NLJScenario = {
  id: 'test-scenario',
  name: 'Test Scenario',
  orientation: 'horizontal',
  activityType: 'training',
  nodes: [
    {
      id: 'start',
      type: 'start',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    },
  ],
  links: [],
};

describe('FlowViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(
        <TestWrapper>
          <FlowViewer scenario={mockScenario} />
        </TestWrapper>
      );
      expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument();
    });

    it('renders the ReactFlow component', () => {
      render(
        <TestWrapper>
          <FlowViewer scenario={mockScenario} />
        </TestWrapper>
      );
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('renders with different themes', () => {
      render(
        <TestWrapper>
          <FlowViewer scenario={mockScenario} theme="hyundai" />
        </TestWrapper>
      );
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  describe('Optional Features', () => {
    it('renders controls when showControls is true', () => {
      render(
        <TestWrapper>
          <FlowViewer scenario={mockScenario} showControls={true} />
        </TestWrapper>
      );
      expect(screen.getByTestId('flow-controls')).toBeInTheDocument();
    });

    it('renders minimap when showMiniMap is true', () => {
      render(
        <TestWrapper>
          <FlowViewer scenario={mockScenario} showMiniMap={true} />
        </TestWrapper>
      );
      expect(screen.getByTestId('flow-minimap')).toBeInTheDocument();
    });

    it('renders background when showBackground is true', () => {
      render(
        <TestWrapper>
          <FlowViewer scenario={mockScenario} showBackground={true} />
        </TestWrapper>
      );
      expect(screen.getByTestId('flow-background')).toBeInTheDocument();
    });

    it('does not render controls when showControls is false', () => {
      render(
        <TestWrapper>
          <FlowViewer scenario={mockScenario} showControls={false} />
        </TestWrapper>
      );
      expect(screen.queryByTestId('flow-controls')).not.toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('handles readOnly prop', () => {
      render(
        <TestWrapper>
          <FlowViewer scenario={mockScenario} readOnly={true} />
        </TestWrapper>
      );
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('handles custom header height', () => {
      render(
        <TestWrapper>
          <FlowViewer scenario={mockScenario} headerHeight={150} />
        </TestWrapper>
      );
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('handles callbacks without crashing', () => {
      const mockOnSave = vi.fn();
      const mockOnExport = vi.fn();
      const mockOnScenarioChange = vi.fn();

      render(
        <TestWrapper>
          <FlowViewer 
            scenario={mockScenario}
            onSave={mockOnSave}
            onExport={mockOnExport}
            onScenarioChange={mockOnScenarioChange}
          />
        </TestWrapper>
      );
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles empty scenario gracefully', () => {
      const emptyScenario: NLJScenario = {
        id: 'empty',
        name: 'Empty Scenario',
        orientation: 'horizontal',
        activityType: 'training',
        nodes: [],
        links: [],
      };

      render(
        <TestWrapper>
          <FlowViewer scenario={emptyScenario} />
        </TestWrapper>
      );
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('handles invalid scenario data gracefully', () => {
      const invalidScenario = {
        ...mockScenario,
        nodes: [
          {
            id: 'invalid',
            type: 'invalid-type' as any,
            x: 100,
            y: 100,
            width: 200,
            height: 100,
          },
        ],
      };

      render(
        <TestWrapper>
          <FlowViewer scenario={invalidScenario} />
        </TestWrapper>
      );
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });
});