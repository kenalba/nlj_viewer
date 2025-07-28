/**
 * Main Application Component
 * Unified app with role-based access and simplified routing
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { GameProvider, useGameContext } from './contexts/GameContext';
import { AppLayout } from './shared/AppLayout';
import { GameView } from './player/GameView';
import { ScenarioLoader } from './player/ScenarioLoader';
import { XAPIResultsScreen } from './player/XAPIResultsScreen';
import { ContentLibrary } from './player/ContentLibrary';
import { ContentDashboard } from './editor/ContentDashboard';
import { FlowEditor } from './editor/FlowEditor';
import { ApprovalDashboard } from './player/ApprovalDashboard';
import { PlayActivityLoader } from './player/PlayActivityLoader';
import { DetailedReviewPage } from './pages/DetailedReviewPage';
import { useAuth } from './contexts/AuthContext';
import { contentApi } from './api/content';
import { HomePage } from './components/HomePage';
import type { NLJScenario } from './types/nlj';

const AppContent: React.FC = () => {
  const { state, reset } = useGameContext();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentScenario, setCurrentScenario] = useState<NLJScenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<NLJScenario | null>(null);
  const [loadingScenario, setLoadingScenario] = useState<boolean>(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  
  
  // Load scenario from localStorage when game state changes
  useEffect(() => {
    if (state.scenarioId) {
      const scenarioData = localStorage.getItem(`scenario_${state.scenarioId}`);
      if (scenarioData) {
        setCurrentScenario(JSON.parse(scenarioData));
      }
    } else {
      setCurrentScenario(null);
    }
  }, [state.scenarioId]);

  const handleHome = () => {
    reset();
    setCurrentScenario(null);
    // Navigate back to Activities page instead of showing scenario loader
    navigate('/app/activities');
  };

  const canEdit = user?.role && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role);
  const canReview = user?.role && ['reviewer', 'approver', 'admin'].includes(user.role);

  // Load scenario from Content API when editing
  useEffect(() => {
    const loadScenarioForEditing = async () => {
      // Parse editId from path segments instead of query params
      const pathSegments = location.pathname.split('/');
      const flowIndex = pathSegments.indexOf('flow');
      const action = flowIndex !== -1 ? pathSegments[flowIndex + 1] : null;
      const editId = action === 'edit' ? pathSegments[flowIndex + 2] : null;
      
      if (editId && !editingScenario && !loadingScenario) {
        setLoadingScenario(true);
        setScenarioError(null);
        
        try {
          const contentItem = await contentApi.get(editId);
          
          // Convert ContentItem to NLJScenario format
          const scenario: NLJScenario = {
            id: contentItem.id,
            name: contentItem.title,
            description: contentItem.description,
            ...contentItem.nlj_data
          };
          
          setEditingScenario(scenario);
        } catch (error) {
          console.error('Failed to load scenario for editing:', error);
          setScenarioError('Failed to load scenario. Please try again.');
        } finally {
          setLoadingScenario(false);
        }
      }
    };

    if (location.pathname.includes('/flow')) {
      loadScenarioForEditing();
    } else {
      // Clear editing scenario when not on flow page
      if (editingScenario) {
        setEditingScenario(null);
      }
      if (scenarioError) {
        setScenarioError(null);
      }
    }
  }, [location.pathname, editingScenario, loadingScenario, scenarioError]);

  // Create blank scenario for new content
  const createBlankScenario = (): NLJScenario => {
    return {
      id: `new-${Date.now()}`,
      name: 'New Activity',
      description: 'A new activity created with the Flow Editor',
      nodes: [
        {
          id: 'start',
          type: 'start',
          x: 100,
          y: 100,
          width: 200,
          height: 100,
          data: {
            title: 'Start',
            content: 'This is the starting node of your activity. Click Edit to customize this content.'
          }
        },
        {
          id: 'end',
          type: 'end',
          x: 400,
          y: 100,
          width: 200,
          height: 100,
          data: {
            title: 'End',
            content: 'This is the ending node of your activity. You can customize this content or connect more nodes.'
          }
        }
      ],
      links: [{
        id: 'start-to-end',
        sourceNodeId: 'start',
        targetNodeId: 'end'
      }],
      variableDefinitions: []
    };
  };

  // Super simple path matching
  const path = location.pathname;
  
  if (path.includes('/activities')) {
    return <ContentLibrary contentType="all" />;
  }
  
  if (path.includes('/approvals') && canReview) {
    return <ApprovalDashboard />;
  }

  // Handle detailed review page
  if (path.includes('/app/review/') && canReview) {
    const pathSegments = path.split('/');
    const reviewIndex = pathSegments.indexOf('review');
    const workflowId = reviewIndex !== -1 ? pathSegments[reviewIndex + 1] : null;
    
    if (workflowId) {
      return <DetailedReviewPage />;
    }
  }
  
  if (path.includes('/dashboard') && canEdit) {
    return <ContentDashboard onEditScenario={setEditingScenario} />;
  }
  
  // Handle playing specific activities with content-aware URLs
  if (path.includes('/app/play/')) {
    const pathSegments = path.split('/');
    const playIndex = pathSegments.indexOf('play');
    const contentId = playIndex !== -1 ? pathSegments[playIndex + 1] : null;
    
    // Check for review mode
    const urlParams = new URLSearchParams(location.search);
    const isReviewMode = urlParams.get('review_mode') === 'true';
    
    if (contentId && state.scenarioId && state.currentNodeId && currentScenario) {
      return (
        <GameView 
          scenario={currentScenario} 
          onHome={handleHome} 
          reviewMode={isReviewMode}
        />
      );
    }
    
    // If we have a content ID but no loaded scenario, load it
    if (contentId) {
      // Use a custom hook or effect to load the scenario based on review mode permissions
      return <PlayActivityLoader contentId={contentId} isReviewMode={isReviewMode} canReview={canReview} />;
    }
  }
  
  if (path.includes('/app/flow') && canEdit) {
    // Parse URL structure: /app/flow/new or /app/flow/edit/[id]
    const pathSegments = path.split('/');
    const flowIndex = pathSegments.indexOf('flow');
    const action = pathSegments[flowIndex + 1]; // 'new' or 'edit'
    const editId = action === 'edit' ? pathSegments[flowIndex + 2] : null;
    
    // Show loading state while fetching scenario
    if (loadingScenario) {
      return (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="400px" gap={2}>
          <CircularProgress />
          <Typography>Loading scenario for editing...</Typography>
        </Box>
      );
    }
    
    // Show error state if loading failed
    if (scenarioError) {
      return (
        <Box p={3}>
          <Alert severity="error" action={
            <button onClick={() => window.location.reload()}>Retry</button>
          }>
            {scenarioError}
          </Alert>
        </Box>
      );
    }
    
    // Determine scenario to edit
    let scenarioToEdit = editingScenario;
    
    // If creating new activity and no editing scenario, check for template in navigation state
    if (action === 'new' && !editingScenario) {
      const navigationState = location.state as any;
      if (navigationState?.template) {
        // Use template from navigation state
        scenarioToEdit = {
          ...navigationState.template,
          id: `new-${Date.now()}`,
          name: navigationState.name || navigationState.template.name,
          description: navigationState.description || navigationState.template.description
        };
        // Clear the navigation state to prevent issues with back navigation
        window.history.replaceState({}, '', location.pathname);
      } else {
        // Create blank scenario
        scenarioToEdit = createBlankScenario();
      }
      setEditingScenario(scenarioToEdit);
    }
    
    // If we have an edit ID but still no scenario, wait for loading
    if (editId && !scenarioToEdit) {
      return (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="400px" gap={2}>
          <CircularProgress />
          <Typography>Loading scenario for editing...</Typography>
        </Box>
      );
    }
    
    return (
      <FlowEditor
        scenario={scenarioToEdit!}
        onBack={() => {
          setEditingScenario(null);
          window.history.back();
        }}
        onPlay={(scenario) => {
          // Store scenario for playing
          localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
          // Navigate to game view
          window.location.href = '/app';
        }}
        onSave={async (scenario) => {
          setEditingScenario(scenario);
          
          try {
            // Determine if we're creating new content or updating existing
            const isNewScenario = scenario.id.startsWith('new-');
            
            if (isNewScenario) {
              // Create new content item
              const contentData = {
                title: scenario.name,
                description: scenario.description || 'Activity created with Flow Editor',
                nlj_data: {
                  nodes: scenario.nodes,
                  links: scenario.links,
                  variableDefinitions: scenario.variableDefinitions
                },
                content_type: 'training' as const, // Default to training
                learning_style: 'visual' as const, // Default to visual
                is_template: false,
                template_category: 'Custom'
              };
              
              const createdContent = await contentApi.create(contentData);
              
              // Update scenario with real ID from database
              const updatedScenario = {
                ...scenario,
                id: createdContent.id
              };
              
              setEditingScenario(updatedScenario);
              
              // Update URL to reflect the new ID
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.set('edit', createdContent.id);
              window.history.replaceState({}, '', newUrl.toString());
              
              console.log('Created new content item:', createdContent.id);
            } else {
              // Update existing content item
              const updateData = {
                title: scenario.name,
                description: scenario.description || 'Activity updated with Flow Editor',
                nlj_data: {
                  nodes: scenario.nodes,
                  links: scenario.links,
                  variableDefinitions: scenario.variableDefinitions
                }
              };
              
              await contentApi.update(scenario.id, updateData);
              console.log('Updated existing content item:', scenario.id);
            }
            
            // TODO: Show success notification
            console.log('Scenario saved successfully!');
            
          } catch (error) {
            console.error('Failed to save scenario:', error);
            // TODO: Show error notification
            alert('Failed to save scenario. Please try again.');
          }
        }}
        onExport={(scenario) => {
          // Download as JSON
          const dataStr = JSON.stringify(scenario, null, 2);
          const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
          const exportFileDefaultName = `${scenario.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
          
          const linkElement = document.createElement('a');
          linkElement.setAttribute('href', dataUri);
          linkElement.setAttribute('download', exportFileDefaultName);
          linkElement.click();
        }}
      />
    );
  }
  
  if (path.includes('/results/')) {
    return <XAPIResultsScreen />;
  }
  
  // Default: Home page
  return state.scenarioId && state.currentNodeId && currentScenario ? (
    <GameView scenario={currentScenario} onHome={handleHome} />
  ) : (
    <HomePage />
  );
};

export const App: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  const contentLibrary = {
    scenarios: 9,
    surveys: 4,
    games: 6,
    templates: 20
  };

  const appMode = user?.role && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role) ? 'editor' : 'player';
  
  // Debug the actual pathname for troubleshooting
  console.log('App Current pathname:', location.pathname);
  console.log('App Current search:', location.search);

  return (
    <GameProvider>
      <AppLayout 
        mode={appMode} 
        contentLibrary={contentLibrary}
      >
        <AppContent />
      </AppLayout>
    </GameProvider>
  );
};