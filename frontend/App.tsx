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
import { ContentGenerationPage } from './pages/ContentGenerationPage';
import { SubmitForReviewPage } from './pages/SubmitForReviewPage';
import { UserDetailPage } from './pages/UserDetailPage';
import SourceLibraryPage from './pages/SourceLibraryPage';
import SourceDetailPage from './pages/SourceDetailPage';
import ActivityDetailPage from './pages/ActivityDetailPage';
import MediaLibraryPage from './pages/MediaLibraryPage';
import MediaDetailPage from './pages/MediaDetailPage';
import PodcastGenerationPage from './pages/PodcastGenerationPage';
import { PeopleTab } from './components/people/PeopleTab';
import { useAuth } from './contexts/AuthContext';
import { contentApi, type ContentItem } from './api/content';
// import { HomePage } from './components/HomePage';

// Import the full HomePage component
import { HomePage } from './components/HomePage';
// import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicActivityPlayer } from './components/PublicActivityPlayer';
import TrainingSessionsPage from './pages/TrainingSessionsPage';
import CreateProgramPage from './pages/CreateProgramPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import CreateSessionPage from './pages/CreateSessionPage';
import type { NLJScenario } from './types/nlj';
import { canEditContent, canReviewContent, canManageUsers, getAppMode } from './utils/permissions';

// Preview component for generated content
const PreviewGeneratedContent: React.FC<{ onHome: () => void }> = ({ onHome }) => {
  const { dispatch } = useGameContext();
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    const previewData = sessionStorage.getItem('preview_activity');
    if (previewData) {
      try {
        const previewScenario: NLJScenario = JSON.parse(previewData);
        dispatch({ type: 'LOAD_SCENARIO', payload: previewScenario });
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to parse preview data:', error);
        navigate('/app/content-generation');
      }
    } else {
      navigate('/app/content-generation');
    }
  }, [dispatch, navigate]);
  
  if (isLoading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="400px" gap={2}>
        <CircularProgress />
        <Typography>Loading preview...</Typography>
      </Box>
    );
  }
  
  return null; // Will be handled by the game view route after scenario loads
};

const AppContent: React.FC = () => {
  const { state, reset } = useGameContext();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentScenario, setCurrentScenario] = useState<NLJScenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<NLJScenario | null>(null);
  const [editingContentItem, setEditingContentItem] = useState<ContentItem | null>(null);
  const [loadingScenario, setLoadingScenario] = useState<boolean>(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  
  
  // Load scenario from localStorage when game state changes
  useEffect(() => {
    if (state.scenarioId) {
      // Check if this is a preview scenario (from sessionStorage)
      const previewData = sessionStorage.getItem('preview_activity');
      if (previewData && location.pathname.includes('/app/preview-generated')) {
        try {
          const previewScenario = JSON.parse(previewData);
          if (previewScenario.id === state.scenarioId) {
            setCurrentScenario(previewScenario);
            return;
          }
        } catch (error) {
          console.error('Failed to parse preview data:', error);
        }
      }
      
      // Otherwise load from localStorage as usual
      const scenarioData = localStorage.getItem(`scenario_${state.scenarioId}`);
      if (scenarioData) {
        setCurrentScenario(JSON.parse(scenarioData));
      }
    } else {
      setCurrentScenario(null);
    }
  }, [state.scenarioId, location.pathname]);

  const handleHome = () => {
    reset();
    setCurrentScenario(null);
    // Navigate back to home page
    navigate('/app/home');
  };

  const canEdit = canEditContent(user);
  const canReview = canReviewContent(user);
  const isAdmin = canManageUsers(user);

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
          setEditingContentItem(contentItem);
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
      if (editingContentItem) {
        setEditingContentItem(null);
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
  
  // Handle home route explicitly
  if (path === '/app/home') {
    return state.scenarioId && state.currentNodeId && currentScenario ? (
      <GameView scenario={currentScenario} onHome={handleHome} />
    ) : (
      <HomePage />
    );
  }
  
  // Note: /app route should be handled by AppRouter redirect, not here
  
  if (path.includes('/activities')) {
    // Activity detail page: /app/activities/[id]
    if (path.includes('/app/activities/') && path.split('/').length > 3) {
      return <ActivityDetailPage />;
    }
    // Main activities page: /app/activities
    return <ContentLibrary contentType="all" />;
  }
  
  if (path.includes('/approvals') && canReview) {
    return <ApprovalDashboard />;
  }

  // Handle People management routes (admin only)
  if (path.includes('/people') && isAdmin) {
    // User detail page: /app/people/[userId]
    if (path.includes('/app/people/') && path.split('/').length > 3) {
      return <UserDetailPage />;
    }
    // Main people page: /app/people
    return <PeopleTab />;
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
  
  if (path.includes('/generate-podcast') && canEdit) {
    return <PodcastGenerationPage />;
  }
  
  if (path.includes('/generate') && canEdit) {
    return <ContentGenerationPage />;
  }
  
  if (path.includes('/sources')) {
    // Source detail page: /app/sources/[id]
    if (path.includes('/app/sources/') && path.split('/').length > 3) {
      return <SourceDetailPage />;
    }
    // Main sources page: /app/sources
    return <SourceLibraryPage />;
  }

  if (path.includes('/media')) {
    // Media detail page: /app/media/[id]
    if (path.includes('/app/media/') && path.split('/').length > 3) {
      return <MediaDetailPage />;
    }
    // Main media page: /app/media
    return <MediaLibraryPage />;
  }

  if (path.includes('/training')) {
    // Create new program page: /app/training/create
    if (path.includes('/training/create') && canEdit) {
      return <CreateProgramPage />;
    }
    // Program detail page: /app/training/programs/[id]
    if (path.includes('/training/programs/') && path.split('/').length > 4) {
      const pathSegments = path.split('/');
      const programsIndex = pathSegments.indexOf('programs');
      const programId = pathSegments[programsIndex + 1];
      const action = pathSegments[programsIndex + 2];
      
      // Create session page: /app/training/programs/[id]/create-session
      if (action === 'create-session' && canEdit) {
        return <CreateSessionPage />;
      }
      // Edit program page: /app/training/programs/[id]/edit
      if (action === 'edit' && canEdit) {
        // For now, redirect to program detail page - could implement edit page later
        return <ProgramDetailPage />;
      }
      // Program detail page: /app/training/programs/[id]
      return <ProgramDetailPage />;
    }
    // Main training sessions page: /app/training
    return <TrainingSessionsPage />;
  }
  
  if (path.includes('/app/submit-review') && canEdit) {
    return <SubmitForReviewPage />;
  }
  
  // Handle preview of generated content
  if (path.includes('/app/preview-generated')) {
    return (
      <PreviewGeneratedContent 
        onHome={() => {
          sessionStorage.removeItem('preview_activity');
          navigate('/app/content-generation');
        }}
      />
    );
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
    // Parse URL structure: /app/flow/new or /app/flow/edit/[id] or /app/flow?scenario=ID
    const pathSegments = path.split('/');
    const flowIndex = pathSegments.indexOf('flow');
    const action = pathSegments[flowIndex + 1]; // 'new' or 'edit' or undefined for query param
    const editId = action === 'edit' ? pathSegments[flowIndex + 2] : null;
    
    // Check for scenario query parameter (from Content Studio)
    const urlParams = new URLSearchParams(location.search);
    const scenarioParam = urlParams.get('scenario');
    
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
    
    // Handle scenario from Content Studio (query parameter)
    if (scenarioParam && !editingScenario) {
      const scenarioData = localStorage.getItem(`scenario_${scenarioParam}`);
      const navigationState = location.state as any;
      if (scenarioData) {
        scenarioToEdit = JSON.parse(scenarioData);
        setEditingScenario(scenarioToEdit);
      } else if (navigationState?.generatedScenario) {
        scenarioToEdit = navigationState.generatedScenario;
        setEditingScenario(scenarioToEdit);
      }
    }
    
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
        contentItem={editingContentItem || undefined}
        canManageVersions={!!editingContentItem}
        onBack={() => {
          setEditingScenario(null);
          setEditingContentItem(null);
          window.history.back();
        }}
        onPlay={(scenario) => {
          // Store scenario for playing
          localStorage.setItem(`scenario_${scenario.id}`, JSON.stringify(scenario));
          // Navigate to play view with the scenario ID
          if (editingContentItem) {
            navigate(`/app/play/${editingContentItem.id}`);
          } else {
            // For new scenarios, we need to save first or use temporary preview
            navigate('/app/activities');
          }
        }}
        onSave={async (scenario) => {
          setEditingScenario(scenario);
          
          try {
            // Determine if we're creating new content or updating existing
            const isNewScenario = scenario.id.startsWith('new-');
            
            if (isNewScenario) {
              // Create new content item with complete NLJ scenario data as draft
              const contentData = {
                title: scenario.name,
                description: scenario.description || 'Activity created with Flow Editor',
                nlj_data: {
                  ...scenario, // Include all scenario properties
                  id: scenario.id // Ensure ID is preserved
                },
                content_type: (scenario.activityType as any) || 'training', // Use scenario's activity type or default
                learning_style: 'visual' as const, // Default to visual
                is_template: false,
                template_category: 'Custom',
                state: 'draft' // Explicitly save as draft
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
              // Update existing content item with complete NLJ scenario data
              // Keep content in draft state when editing (unless it's published)
              const updateData = {
                title: scenario.name,
                description: scenario.description || 'Activity updated with Flow Editor',
                nlj_data: {
                  ...scenario // Include all scenario properties
                },
                // Preserve existing state, but ensure drafts remain drafts
                ...(editingContentItem?.state !== 'published' && { state: 'draft' })
              };
              
              await contentApi.update(scenario.id, updateData);
              console.log('Updated existing content item:', scenario.id);
            }
            
            // Show success notification  
            console.log('Scenario saved successfully!');
            // Note: The FlowEditor component handles showing save success feedback
            
          } catch (error) {
            console.error('Failed to save scenario:', error);
            
            // Provide specific error feedback
            let errorMessage = 'Failed to save scenario. Please try again.';
            if (error instanceof Error) {
              if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error: Please check your connection and try again.';
              } else if (error.message.includes('400')) {
                errorMessage = 'Invalid data: Please check your scenario for errors and try again.';
              } else if (error.message.includes('401') || error.message.includes('403')) {
                errorMessage = 'Permission denied: You may not have rights to save this content.';
              }
            }
            
            // Show error alert (TODO: Replace with notification system)
            alert(errorMessage);
            throw error; // Re-throw so FlowEditor can handle UI state
          }
        }}
        onExport={(scenario: NLJScenario) => {
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
  
  // Catch-all: redirect to home
  navigate('/app/home', { replace: true });
  return <Box sx={{ p: 3, textAlign: 'center' }}><Typography>Redirecting to home...</Typography></Box>;
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

  const appMode = getAppMode(user);

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