/**
 * Unified Application
 * Single application combining Player and Editor functionality with role-based access
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { GameProvider, useGameContext } from './contexts/GameContext';
import { AppLayout } from './shared/AppLayout';
import { GameView } from './player/GameView';
import { ScenarioLoader } from './player/ScenarioLoader';
import { XAPIResultsScreen } from './player/XAPIResultsScreen';
import { ContentLibrary } from './player/ContentLibrary';
import { ContentDashboard } from './editor/ContentDashboard';
import { FlowEditor } from './editor/FlowEditor';
import { useAuth } from './contexts/AuthContext';
import type { NLJScenario } from './types/nlj';

const UnifiedContent: React.FC = () => {
  const { state, reset, loadScenario } = useGameContext();
  const { user } = useAuth();
  const location = useLocation();
  const [currentScenario, setCurrentScenario] = useState<NLJScenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<NLJScenario | null>(null);
  
  // Debug logging
  console.log('UnifiedContent render:', { 
    windowPath: window.location.pathname,
    routerPath: location.pathname,
    user: user?.username,
    role: user?.role 
  });
  
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
  };

  // Check if user has creation/editing permissions
  const canEdit = user?.role && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role);

  // Simple path-based routing - no nested Routes conflicts
  const renderContent = () => {
    const path = location.pathname;
    
    console.log('Rendering content for path:', path);
    
    // Add test navigation button for debugging
    const testNavigate = () => {
      console.log('Test navigation clicked');
      // This should work since we're inside the router context
      window.location.href = '/nlj_viewer/app/activities';
    };
    
    if (path === '/app/activities') {
      return <ContentLibrary contentType="all" />;
    }
    
    if (path === '/app/dashboard') {
      if (!canEdit) {
        return <div>Access denied - insufficient permissions</div>;
      }
      return <ContentDashboard onEditScenario={setEditingScenario} />;
    }
    
    if (path === '/app/flow') {
      if (!canEdit) {
        return <div>Access denied - insufficient permissions</div>;
      }
      if (!editingScenario) {
        return <div>No scenario selected</div>;
      }
      return (
        <FlowEditor
          scenario={editingScenario}
          onBack={() => setEditingScenario(null)}
          onPlay={(scenario) => {
            console.log('Play scenario:', scenario.name);
          }}
          onSave={(scenario) => {
            console.log('Save scenario:', scenario.name);
            setEditingScenario(scenario);
          }}
          onExport={(scenario) => {
            console.log('Export scenario:', scenario.name);
          }}
        />
      );
    }
    
    if (path.startsWith('/app/results/')) {
      return <XAPIResultsScreen />;
    }
    
    // Default home content
    if (path === '/app') {
      return (
        <div>
          {/* Debug navigation test */}
          <button onClick={testNavigate} style={{ marginBottom: '20px', padding: '10px', backgroundColor: 'red', color: 'white' }}>
            TEST: Navigate to Activities
          </button>
          
          {state.scenarioId && state.currentNodeId && currentScenario ? (
            <GameView 
              scenario={currentScenario} 
              onHome={handleHome}
            />
          ) : (
            <ScenarioLoader 
              onFlowEdit={() => {
                if (canEdit) {
                  console.log('Edit flow requested');
                }
              }}
            />
          )}
        </div>
      );
    }
    
    return <div>Route not found: {path}</div>;
  };

  return renderContent();
};

export const UnifiedApp: React.FC = () => {
  const { user } = useAuth();

  // Mock content library counts - will be replaced with API data
  const contentLibrary = {
    scenarios: 9,
    surveys: 4,
    games: 6,
    templates: 20
  };

  // Determine app mode based on user role
  // Users with creation permissions see editor features, others see player features
  const appMode = user?.role && ['creator', 'reviewer', 'approver', 'admin'].includes(user.role) ? 'editor' : 'player';

  return (
    <GameProvider>
      <AppLayout 
        mode={appMode}
        contentLibrary={contentLibrary}
      >
        <UnifiedContent />
      </AppLayout>
    </GameProvider>
  );
};