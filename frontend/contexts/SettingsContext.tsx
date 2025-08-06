/**
 * Settings Context for NLJ Activities
 * Provides resolved settings using inheritance: Node settings > Activity settings > Defaults
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { NLJScenario, NLJNode } from '../types/nlj';
import type { ResolvedSettings } from '../types/settings';
import { resolveSettings, validateActivitySettings, validateNodeSettings } from '../types/settings';

interface SettingsContextType {
  scenario: NLJScenario;
  getNodeSettings: (nodeId: string) => ResolvedSettings;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

interface SettingsProviderProps {
  scenario: NLJScenario;
  children: React.ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ scenario, children }) => {
  // Validate activity-level settings
  useMemo(() => {
    if (scenario.settings && !validateActivitySettings(scenario.settings)) {
      console.warn(`Invalid activity settings for scenario ${scenario.id}:`, scenario.settings);
    }
  }, [scenario.settings, scenario.id]);

  // Create a map of nodes for efficient lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, NLJNode>();
    scenario.nodes.forEach(node => {
      map.set(node.id, node);
      
      // Validate node-level settings
      if (isInteractiveNode(node) && 'settings' in node && node.settings) {
        if (!validateNodeSettings(node.settings)) {
          console.warn(`Invalid node settings for node ${node.id}:`, node.settings);
        }
      }
    });
    return map;
  }, [scenario.nodes]);

  // Memoized settings resolution cache
  const settingsCache = useMemo(() => {
    const cache = new Map<string, ResolvedSettings>();
    
    // Pre-compute resolved settings for all nodes
    scenario.nodes.forEach(node => {
      // Only compute settings for nodes that support them (interactive nodes)
      if (isInteractiveNode(node)) {
        const nodeSettings = 'settings' in node ? node.settings : undefined;
        const resolved = resolveSettings(scenario.settings, nodeSettings);
        cache.set(node.id, resolved);
      }
    });
    
    return cache;
  }, [scenario.settings, scenario.nodes]);

  const getNodeSettings = (nodeId: string): ResolvedSettings => {
    try {
      // Try cache first
      const cached = settingsCache.get(nodeId);
      if (cached) {
        return cached;
      }

      // Fallback: resolve settings on demand
      const node = nodeMap.get(nodeId);
      if (!node || !isInteractiveNode(node)) {
        // Return default settings for non-interactive nodes
        return resolveSettings(scenario.settings);
      }

      const nodeSettings = 'settings' in node ? node.settings : undefined;
      const resolved = resolveSettings(scenario.settings, nodeSettings);
      
      // Cache for future use
      settingsCache.set(nodeId, resolved);
      
      return resolved;
    } catch (error) {
      console.warn(`Error resolving settings for node ${nodeId}:`, error);
      // Fallback to default settings
      return resolveSettings();
    }
  };

  const contextValue = useMemo(() => ({
    scenario,
    getNodeSettings,
  }), [scenario, getNodeSettings]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
};

/**
 * Type guard to check if a node supports settings (is interactive)
 */
function isInteractiveNode(node: NLJNode): node is Extract<NLJNode, { settings?: any }> {
  // Non-interactive nodes don't have settings
  const nonInteractiveTypes = ['start', 'end', 'choice', 'interstitial_panel'];
  return !nonInteractiveTypes.includes(node.type);
}