import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ScenarioLoader } from '../ScenarioLoader';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { hyundaiTheme } from '../../theme/hyundaiTheme';

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = MockResizeObserver as any;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234-5678-9012-3456',
  },
  writable: true,
});

// Mock the game context
const mockLoadScenario = vi.fn();
vi.mock('../../contexts/GameContext', () => ({
  useGameContext: () => ({
    loadScenario: mockLoadScenario,
    state: { scenarioId: null, currentNodeId: null, variables: {}, completed: false },
    navigateToNode: vi.fn(),
    updateVariable: vi.fn(),
    completeScenario: vi.fn(),
    reset: vi.fn(),
    calculateConnectionsGameScore: vi.fn(),
    calculateWordleGameScore: vi.fn(),
  }),
}));

// Mock the audio context
const mockPlaySound = vi.fn();
vi.mock('../../contexts/AudioContext', () => ({
  useAudio: () => ({
    playSound: mockPlaySound,
  }),
}));

// Mock scenario validation
vi.mock('../../utils/scenarioUtils', () => ({
  validateScenario: vi.fn().mockReturnValue([]),
}));

// Mock trivie interpreter
vi.mock('../../utils/trivieInterpreter', () => ({
  parseTrivieExcel: vi.fn().mockResolvedValue({}),
  convertTrivieToNLJ: vi.fn().mockReturnValue({}),
  validateTrivieQuiz: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
}));

// Mock XAPIContext
vi.mock('../../contexts/XAPIContext', () => ({
  useXAPI: () => ({
    trackActivityLaunched: vi.fn(),
    trackQuestionAnswered: vi.fn(),
    trackActivityCompleted: vi.fn(),
  }),
}));

// Mock theme context
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    themeMode: 'hyundai',
    toggleTheme: vi.fn(),
  }),
}));

// Mock file reading
global.fetch = vi.fn();

// Mock DOM methods
Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  },
  writable: true,
});

// Mock document.createElement for download tests
const originalCreateElement = document.createElement;
const mockDocumentCreateElement = vi.fn().mockImplementation((tagName) => {
  if (tagName === 'a') {
    const mockElement = {
      href: '',
      download: '',
      click: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      style: {},
      parentNode: null,
      nodeType: 1,
      nodeName: 'A',
      tagName: 'A',
    };
    return mockElement;
  }
  return originalCreateElement.call(document, tagName);
});
Object.defineProperty(document, 'createElement', {
  value: mockDocumentCreateElement,
  writable: true,
});

// Mock document.body.appendChild and removeChild for download functionality
const originalAppendChild = document.body.appendChild;
const originalRemoveChild = document.body.removeChild;
const mockAppendChild = vi.fn().mockImplementation((node) => {
  // Allow normal DOM operations to continue
  if (node && node.tagName === 'A') {
    // Just mock the anchor element operations
    return node;
  }
  return originalAppendChild.call(document.body, node);
});
const mockRemoveChild = vi.fn().mockImplementation((node) => {
  // Allow normal DOM operations to continue
  if (node && node.tagName === 'A') {
    // Just mock the anchor element operations
    return node;
  }
  return originalRemoveChild.call(document.body, node);
});
document.body.appendChild = mockAppendChild;
document.body.removeChild = mockRemoveChild;

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MuiThemeProvider theme={hyundaiTheme}>
    {children}
  </MuiThemeProvider>
);

describe('ScenarioLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful fetch responses
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'test-scenario',
        name: 'Test Scenario',
        nodes: [],
        links: [],
        orientation: 'horizontal',
        activityType: 'training'
      }),
    });
  });

  it('renders the scenario loader with default NLJ tab', () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    expect(screen.getByText('NLJs')).toBeInTheDocument();
    expect(screen.getByText('Upload NLJ')).toBeInTheDocument();
    expect(screen.getByText('Sample Scenarios')).toBeInTheDocument();
  });

  it('renders all activity type tabs', () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    expect(screen.getByText('NLJs')).toBeInTheDocument();
    expect(screen.getByText('Trivie Quizzes')).toBeInTheDocument();
    expect(screen.getByText('Surveys')).toBeInTheDocument();
    expect(screen.getByText('Connections')).toBeInTheDocument();
    expect(screen.getByText('Wordle')).toBeInTheDocument();
  });

  it('switches between activity types when tabs are clicked', async () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    // Click on Trivie tab
    fireEvent.click(screen.getByText('Trivie Quizzes'));
    await waitFor(() => {
      expect(screen.getByText('Upload Trivie Quiz')).toBeInTheDocument();
    });

    // Click on Surveys tab
    fireEvent.click(screen.getByText('Surveys'));
    await waitFor(() => {
      expect(screen.getByText('Upload Survey')).toBeInTheDocument();
    });

    // Click on Connections tab
    fireEvent.click(screen.getByText('Connections'));
    await waitFor(() => {
      expect(screen.getByText('Upload Connections Game')).toBeInTheDocument();
    });

    // Click on Wordle tab
    fireEvent.click(screen.getByText('Wordle'));
    await waitFor(() => {
      expect(screen.getByText('Upload Wordle Game')).toBeInTheDocument();
    });
  });

  it('displays sample scenarios for NLJ', () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    // Check for some sample scenarios
    expect(screen.getByText('FSA_102_1_40')).toBeInTheDocument();
    expect(screen.getByText('FSA_102_2_10')).toBeInTheDocument();
    expect(screen.getByText('Ioniq9_TestDrive_ProductKnowledge')).toBeInTheDocument();
  });

  it('displays sample scenarios for other activity types', async () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    // Check Connections samples
    fireEvent.click(screen.getByText('Connections'));
    await waitFor(() => {
      expect(screen.getByText('Sample Connections Game')).toBeInTheDocument();
      expect(screen.getByText('Science Connections')).toBeInTheDocument();
    });

    // Check Wordle samples
    fireEvent.click(screen.getByText('Wordle'));
    await waitFor(() => {
      expect(screen.getByText('Sample Wordle Game')).toBeInTheDocument();
      expect(screen.getByText('Easy Wordle')).toBeInTheDocument();
      expect(screen.getByText('Hard Wordle')).toBeInTheDocument();
    });
  });

  it('loads a sample scenario when clicked', async () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    const sampleButton = screen.getByText('FSA_102_1_40');
    fireEvent.click(sampleButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('nls.FSA_102_1_40.json'));
    });
    
    await waitFor(() => {
      expect(mockLoadScenario).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-scenario',
        name: 'Test Scenario'
      }));
    });
  });

  it('handles file upload', async () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    // Find the file input within the Choose File button
    const chooseFileButton = screen.getByRole('button', { name: /choose file/i });
    const fileInput = chooseFileButton.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const testFile = new File(['{"id": "test", "name": "Test", "nodes": [], "links": [], "orientation": "horizontal", "activityType": "training"}'], 'test.json', {
      type: 'application/json'
    });

    // Mock File.prototype.text()
    Object.defineProperty(testFile, 'text', {
      value: () => Promise.resolve('{"id": "test", "name": "Test", "nodes": [], "links": [], "orientation": "horizontal", "activityType": "training"}')
    });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(mockLoadScenario).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test',
        name: 'Test'
      }));
    });
  });

  it('shows loading state during file operations', async () => {
    // Mock a delayed response
    (global.fetch as any).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-scenario',
          name: 'Test Scenario',
          nodes: [],
          links: [],
        })
      }), 100))
    );

    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    const sampleButton = screen.getByText('FSA_102_1_40');
    fireEvent.click(sampleButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // Should hide loading state after completion
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('handles fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    const sampleButton = screen.getByText('FSA_102_1_40');
    fireEvent.click(sampleButton);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('handles invalid JSON gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON'))
    });

    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    const sampleButton = screen.getByText('FSA_102_1_40');
    fireEvent.click(sampleButton);

    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
    });
  });

  it('displays theme and sound toggles', () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    // Theme toggle should be present - check for tooltip text
    const themeToggle = screen.getByLabelText(/switch to.*theme/i);
    expect(themeToggle).toBeInTheDocument();
    
    // Sound toggle should be present - check for tooltip text
    const soundToggle = screen.getByLabelText(/sounds/i);
    expect(soundToggle).toBeInTheDocument();
  });

  it('shows download sample JSON buttons', () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    expect(screen.getByText('Download Sample JSON')).toBeInTheDocument();
  });

  it('handles download sample JSON functionality', async () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    const downloadButton = screen.getByText('Download Sample JSON');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockDocumentCreateElement).toHaveBeenCalledWith('a');
    });
    
    // Verify the download link was created and clicked
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('sample_nljs'));
    });
  });

  it('handles scenario validation errors', async () => {
    // Mock validateScenario to return validation errors for this test
    const { validateScenario } = await import('../../utils/scenarioUtils');
    vi.mocked(validateScenario).mockReturnValueOnce(['Invalid scenario structure']);

    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    const sampleButton = screen.getByText('FSA_102_1_40');
    fireEvent.click(sampleButton);

    await waitFor(() => {
      expect(screen.getByText(/Validation errors:/)).toBeInTheDocument();
    });
    
    // Verify that validateScenario was called
    await waitFor(() => {
      expect(validateScenario).toHaveBeenCalled();
    });
  });

  it('handles Trivie Excel file processing', async () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    // Switch to Trivie tab
    fireEvent.click(screen.getByText('Trivie Quizzes'));

    await waitFor(() => {
      expect(screen.getByText('Quiz Export 2025-07-15')).toBeInTheDocument();
    });

    // Click on sample Trivie quiz
    const trivieButton = screen.getByText('Quiz Export 2025-07-15');
    fireEvent.click(trivieButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('quizzes_export_2025-07-15.xlsx'));
    });
  });

  it('handles Survey file processing', async () => {
    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    // Switch to Surveys tab
    fireEvent.click(screen.getByText('Surveys'));

    await waitFor(() => {
      expect(screen.getByText('Automotive Sales Department')).toBeInTheDocument();
    });

    // Click on sample survey
    const surveyButton = screen.getByText('Automotive Sales Department');
    fireEvent.click(surveyButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('automotive_sales_department.json'));
    });
  });

  it('shows error message in alert for network failures', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestWrapper>
        <ScenarioLoader />
      </TestWrapper>
    );

    const sampleButton = screen.getByText('FSA_102_1_40');
    fireEvent.click(sampleButton);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    // The error should be displayed in an Alert component, not an ErrorModal
    // Since simple network errors don't trigger the ErrorModal, just the Alert
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});