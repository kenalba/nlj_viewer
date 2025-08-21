/**
 * Integration tests for Flow Editor persistence functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowEditor } from '../editor/FlowEditor';
import { contentApi } from '../client/content';
import type { NLJScenario } from '../types/nlj';
import type { ContentItem } from '../client/content';

// Mock the content API
vi.mock('../client/content', () => ({
  contentApi: {
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock other dependencies
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ themeMode: 'light' }),
}));

vi.mock('../contexts/GameContext', () => ({
  useGameContext: () => ({ loadScenario: vi.fn() }),
}));

vi.mock('../hooks/useVersionManagement', () => ({
  useVersionManagement: () => null,
}));

const mockScenario: NLJScenario = {
  id: 'test-scenario-123',
  name: 'Test Activity',
  description: 'A test activity for persistence',
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 100, y: 100 },
      data: { label: 'Start' },
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 300, y: 100 },
      data: { label: 'End' },
    },
  ],
  links: [
    {
      id: 'start-end',
      source: 'start',
      target: 'end',
    },
  ],
  activityType: 'training',
  settings: {},
};

const mockContentItem: ContentItem = {
  id: 'test-scenario-123',
  title: 'Test Activity',
  description: 'A test activity for persistence',
  content_type: 'training',
  state: 'draft',
  is_template: false,
  view_count: 0,
  completion_count: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  nlj_data: mockScenario,
};

describe('Flow Editor Persistence', () => {
  const mockOnSave = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display the scenario title with edit functionality', async () => {
    render(
      <FlowEditor
        scenario={mockScenario}
        contentItem={mockContentItem}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Should display the current title
    expect(screen.getByText('Test Activity')).toBeInTheDocument();

    // Should show edit button
    const editButton = screen.getByRole('button', { name: /edit title/i });
    expect(editButton).toBeInTheDocument();
  });

  it('should allow editing the scenario title', async () => {
    const user = userEvent.setup();
    
    render(
      <FlowEditor
        scenario={mockScenario}
        contentItem={mockContentItem}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit title/i });
    await user.click(editButton);

    // Should show text field
    const textField = screen.getByDisplayValue('Test Activity');
    expect(textField).toBeInTheDocument();

    // Edit the title
    await user.clear(textField);
    await user.type(textField, 'Updated Test Activity');

    // Press Enter to save
    await user.keyboard('{Enter}');

    // Should display updated title
    expect(screen.getByText('Updated Test Activity')).toBeInTheDocument();
  });

  it('should trigger auto-save after title changes', async () => {
    const user = userEvent.setup();
    
    render(
      <FlowEditor
        scenario={mockScenario}
        contentItem={mockContentItem}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit title/i });
    await user.click(editButton);

    // Edit the title
    const textField = screen.getByDisplayValue('Test Activity');
    await user.clear(textField);
    await user.type(textField, 'Auto-save Test');

    // Press Enter to save title
    await user.keyboard('{Enter}');

    // Wait for auto-save to trigger (3 second delay)
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    }, { timeout: 4000 });

    // Verify the saved scenario has the updated name
    const savedScenario = mockOnSave.mock.calls[0][0];
    expect(savedScenario.name).toBe('Auto-save Test');
  });

  it('should show save status indicators', async () => {
    const user = userEvent.setup();
    
    render(
      <FlowEditor
        scenario={mockScenario}
        contentItem={mockContentItem}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Initially should show no changes
    const saveButton = screen.getByRole('button', { name: /no changes to save/i });
    expect(saveButton).toBeDisabled();

    // Make a change
    const editButton = screen.getByRole('button', { name: /edit title/i });
    await user.click(editButton);

    const textField = screen.getByDisplayValue('Test Activity');
    await user.clear(textField);
    await user.type(textField, 'Modified Title');
    await user.keyboard('{Enter}');

    // Should show pending save status
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes \(auto-save in 3s\)/i })).toBeInTheDocument();
    });
  });

  it('should handle save errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockOnSaveError = vi.fn().mockRejectedValue(new Error('Save failed'));

    const user = userEvent.setup();
    
    render(
      <FlowEditor
        scenario={mockScenario}
        contentItem={mockContentItem}
        onBack={mockOnBack}
        onSave={mockOnSaveError}
      />
    );

    // Make a change to trigger save
    const editButton = screen.getByRole('button', { name: /edit title/i });
    await user.click(editButton);

    const textField = screen.getByDisplayValue('Test Activity');
    await user.clear(textField);
    await user.type(textField, 'Error Test');
    await user.keyboard('{Enter}');

    // Click manual save
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    // Should log error
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Manual save failed:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});