/**
 * Editor Application
 * Main application for content creation and management with unified sidebar navigation
 */

import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '../shared/AppLayout';
import { ContentDashboard } from './ContentDashboard';
import { FlowEditor } from './FlowEditor';
import { ContentLibrary } from '../player/ContentLibrary';
import type { NLJScenario } from '../types/nlj';

export const EditorApp: React.FC = () => {
  const [editingScenario, setEditingScenario] = useState<NLJScenario | null>(null);

  // Mock content library counts - will be replaced with API data  
  const contentLibrary = {
    scenarios: 9,
    surveys: 4,
    games: 6,
    templates: 20
  };

  return (
    <AppLayout 
      mode="editor"
      contentLibrary={contentLibrary}
    >
      <Routes>
        <Route
          path="/"
          element={
            <ContentDashboard 
              onEditScenario={setEditingScenario}
            />
          }
        />
        <Route path="/activities" element={<ContentLibrary contentType="all" />} />
        <Route
          path="/flow"
          element={
            editingScenario ? (
              <FlowEditor
                scenario={editingScenario}
                onBack={() => setEditingScenario(null)}
                onPlay={(scenario) => {
                  // Load scenario in player
                  console.log('Play scenario:', scenario.name);
                }}
                onSave={(scenario) => {
                  // Save scenario via API
                  console.log('Save scenario:', scenario.name);
                  setEditingScenario(scenario);
                }}
                onExport={(scenario) => {
                  // Export functionality
                  console.log('Export scenario:', scenario.name);
                }}
              />
            ) : (
              <div>No scenario selected</div>
            )
          }
        />
      </Routes>
    </AppLayout>
  );
};