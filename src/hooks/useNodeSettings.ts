/**
 * Hook for accessing resolved node settings
 * Provides a simple interface for components to get settings for a specific node
 */

import type { ResolvedSettings } from '../types/settings';
import { useSettingsContext } from '../contexts/SettingsContext';

/**
 * Hook to get resolved settings for a specific node
 * @param nodeId - The ID of the node to get settings for
 * @returns ResolvedSettings with all settings values resolved according to inheritance rules
 */
export const useNodeSettings = (nodeId: string): ResolvedSettings => {
  const { getNodeSettings } = useSettingsContext();
  return getNodeSettings(nodeId);
};