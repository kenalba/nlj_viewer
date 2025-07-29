/**
 * Complete example of FlowEditor with version management integration
 * Shows how to properly integrate version management into an existing content editor
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { FlowEditor } from '../editor/FlowEditor';
import { useVersionManagement } from '../hooks/useVersionManagement';
import { useAuth } from '../contexts/AuthContext';
import type { ContentItem } from '../api/content';
import type { NLJScenario } from '../types/nlj';

interface FlowEditorWithVersionsProps {
  contentItem: ContentItem;
  onContentUpdate?: (updatedItem: ContentItem) => void;
}

export const FlowEditorWithVersions: React.FC<FlowEditorWithVersionsProps> = ({
  contentItem,
  onContentUpdate
}) => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  
  // Local scenario state (synced with version management)
  const [currentScenario, setCurrentScenario] = useState<NLJScenario>(contentItem.nlj_data);
  
  // Version management hook
  const versionManagement = useVersionManagement({
    contentItem,
    onVersionChange: (version) => {
      // Update local state when version changes (restore/rollback)
      if (version.nlj_data) {
        setCurrentScenario(version.nlj_data);
        enqueueSnackbar(
          `Restored to version ${version.version_number}`, 
          { variant: 'success' }
        );
      }
    },
    autoLoadVersions: true
  });

  // Check if user can manage versions
  const canManageVersions = Boolean(
    user && 
    ['creator', 'reviewer', 'approver', 'admin'].includes(user.role) &&
    contentItem.state !== 'published' // Don't allow version changes on published content
  );

  // Handle scenario changes from the editor
  const handleScenarioChange = useCallback((updatedScenario: NLJScenario) => {
    setCurrentScenario(updatedScenario);
  }, []);

  // Handle version-aware save
  const handleVersionSave = useCallback(async (changeSummary: string) => {
    try {
      if (!changeSummary.trim()) {
        enqueueSnackbar('Please provide a change summary', { variant: 'warning' });
        return;
      }

      // Create new version using the version management hook
      const newVersion = await versionManagement.createVersion(
        currentScenario,
        contentItem.title,
        contentItem.description,
        changeSummary.trim()
      );

      if (newVersion) {
        enqueueSnackbar(
          `Version ${newVersion.version_number} saved successfully`, 
          { variant: 'success' }
        );
        
        // Notify parent component of content update
        if (onContentUpdate) {
          onContentUpdate({
            ...contentItem,
            nlj_data: currentScenario,
            updated_at: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Failed to save version:', error);
      enqueueSnackbar('Failed to save version', { variant: 'error' });
    }
  }, [currentScenario, contentItem, versionManagement, onContentUpdate, enqueueSnackbar]);

  // Handle traditional save (for compatibility)
  const handleSave = useCallback((scenario: NLJScenario) => {
    setCurrentScenario(scenario);
    
    // For non-version-managed saves, just update localStorage
    localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
    
    enqueueSnackbar('Changes saved locally', { variant: 'info' });
  }, [enqueueSnackbar]);

  // Handle play action
  const handlePlay = useCallback((scenario: NLJScenario) => {
    // Check for unsaved changes
    const hasUnsavedChanges = JSON.stringify(scenario) !== JSON.stringify(versionManagement.currentVersion?.nlj_data);
    
    if (hasUnsavedChanges && canManageVersions) {
      const confirmed = window.confirm(
        'You have unsaved changes. Would you like to save them as a new version before playing?'
      );
      
      if (confirmed) {
        const changeSummary = prompt('Describe your changes:');
        if (changeSummary) {
          handleVersionSave(changeSummary).then(() => {
            navigate(`/app/play/${contentItem.id}`);
          });
          return;
        }
      }
    }
    
    // Play with current scenario
    navigate(`/app/play/${contentItem.id}`);
  }, [contentItem.id, versionManagement.currentVersion, canManageVersions, handleVersionSave, navigate]);

  // Handle export
  const handleExport = useCallback((scenario: NLJScenario) => {
    const blob = new Blob([JSON.stringify(scenario, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contentItem.title}_v${versionManagement.currentVersion?.version_number || 'current'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    enqueueSnackbar('Scenario exported successfully', { variant: 'success' });
  }, [contentItem.title, versionManagement.currentVersion, enqueueSnackbar]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Check for unsaved changes
    const hasUnsavedChanges = versionManagement.currentVersion 
      ? JSON.stringify(currentScenario) !== JSON.stringify(versionManagement.currentVersion.nlj_data)
      : true;

    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave without saving?'
      );
      if (!confirmed) return;
    }
    
    navigate('/content');
  }, [currentScenario, versionManagement.currentVersion, navigate]);

  return (
    <FlowEditor
      scenario={currentScenario}
      contentItem={contentItem}
      canManageVersions={canManageVersions}
      onScenarioChange={handleScenarioChange}
      onVersionSave={handleVersionSave}
      onSave={handleSave}
      onPlay={handlePlay}
      onExport={handleExport}
      onBack={handleBack}
    />
  );
};

// Example usage in a route component
export const ContentEditorRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [contentItem, setContentItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load content item from API
    const loadContent = async () => {
      try {
        const item = await contentApi.getContent(id!);
        setContentItem(item);
      } catch (error) {
        console.error('Failed to load content:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadContent();
    }
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!contentItem) {
    return <div>Content not found</div>;
  }

  return (
    <FlowEditorWithVersions
      contentItem={contentItem}
      onContentUpdate={(updatedItem) => {
        setContentItem(updatedItem);
        // Optional: sync with parent state management
      }}
    />
  );
};

export default FlowEditorWithVersions;