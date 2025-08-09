/**
 * React hook for content version management operations
 * Provides a consistent interface for version history, comparison, and rollback
 */

import { useState, useCallback, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import { workflowApi } from '../client/workflow';
import { ContentVersion, VersionStatus } from '../types/workflow';
import type { ContentItem } from '../client/content';

interface UseVersionManagementOptions {
  contentItem: ContentItem;
  onVersionChange?: (version: ContentVersion) => void;
  autoLoadVersions?: boolean;
}

interface VersionManagementState {
  versions: ContentVersion[];
  loading: boolean;
  currentVersion: ContentVersion | null;
  publishedVersion: ContentVersion | null;
  draftVersion: ContentVersion | null;
}

export const useVersionManagement = ({
  contentItem,
  onVersionChange,
  autoLoadVersions = true
}: UseVersionManagementOptions) => {
  const { enqueueSnackbar } = useSnackbar();
  
  const [state, setState] = useState<VersionManagementState>({
    versions: [],
    loading: false,
    currentVersion: null,
    publishedVersion: null,
    draftVersion: null
  });

  // Load versions from API
  const loadVersions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const versions = await workflowApi.getContentVersions(contentItem.id);
      
      // Sort versions by version number (descending)
      const sortedVersions = versions.sort((a, b) => b.version_number - a.version_number);
      
      // Find special versions
      const currentVersion = sortedVersions[0] || null; // Latest version
      const publishedVersion = versions.find(v => v.version_status === VersionStatus.PUBLISHED) || null;
      const draftVersion = versions.find(v => v.version_status === VersionStatus.DRAFT) || null;
      
      setState({
        versions: sortedVersions,
        loading: false,
        currentVersion,
        publishedVersion,
        draftVersion
      });
      
      return sortedVersions;
    } catch (error) {
      console.error('Failed to load versions:', error);
      enqueueSnackbar('Failed to load version history', { variant: 'error' });
      setState(prev => ({ ...prev, loading: false }));
      return [];
    }
  }, [contentItem.id, enqueueSnackbar]);

  // Create a new version
  const createVersion = useCallback(async (
    nljData: any,
    title: string,
    description?: string,
    changeSummary?: string
  ): Promise<ContentVersion | null> => {
    try {
      const newVersion = await workflowApi.createVersion({
        content_id: contentItem.id,
        nlj_data: nljData,
        title,
        description,
        change_summary: changeSummary
      });

      // Reload versions to get updated list
      await loadVersions();
      
      enqueueSnackbar(`Version ${newVersion.version_number} created successfully`, { 
        variant: 'success' 
      });
      
      if (onVersionChange) {
        onVersionChange(newVersion);
      }
      
      return newVersion;
    } catch (error) {
      console.error('Failed to create version:', error);
      enqueueSnackbar('Failed to create new version', { variant: 'error' });
      return null;
    }
  }, [contentItem.id, loadVersions, onVersionChange, enqueueSnackbar]);

  // Restore to a previous version (creates new version)
  const restoreVersion = useCallback(async (
    sourceVersion: ContentVersion,
    changeSummary?: string
  ): Promise<ContentVersion | null> => {
    try {
      const restoredVersion = await workflowApi.restoreVersion(
        contentItem.id,
        sourceVersion.id,
        changeSummary || `Restored from version ${sourceVersion.version_number}`
      );

      // Reload versions to get updated list
      await loadVersions();
      
      enqueueSnackbar(
        `Successfully restored to version ${sourceVersion.version_number}`, 
        { variant: 'success' }
      );
      
      if (onVersionChange) {
        onVersionChange(restoredVersion);
      }
      
      return restoredVersion;
    } catch (error) {
      console.error('Failed to restore version:', error);
      enqueueSnackbar('Failed to restore version', { variant: 'error' });
      return null;
    }
  }, [contentItem.id, loadVersions, onVersionChange, enqueueSnackbar]);

  // Update version metadata
  const updateVersionMetadata = useCallback(async (
    versionId: string,
    updates: {
      title?: string;
      description?: string;
      change_summary?: string;
    }
  ): Promise<ContentVersion | null> => {
    try {
      const updatedVersion = await workflowApi.updateVersionMetadata(versionId, updates);
      
      // Reload versions to get updated list
      await loadVersions();
      
      enqueueSnackbar('Version metadata updated successfully', { variant: 'success' });
      
      return updatedVersion;
    } catch (error) {
      console.error('Failed to update version metadata:', error);
      enqueueSnackbar('Failed to update version metadata', { variant: 'error' });
      return null;
    }
  }, [loadVersions, enqueueSnackbar]);

  // Archive a version
  const archiveVersion = useCallback(async (
    versionId: string
  ): Promise<ContentVersion | null> => {
    try {
      const archivedVersion = await workflowApi.archiveVersion(versionId);
      
      // Reload versions to get updated list
      await loadVersions();
      
      enqueueSnackbar('Version archived successfully', { variant: 'success' });
      
      return archivedVersion;
    } catch (error) {
      console.error('Failed to archive version:', error);
      enqueueSnackbar('Failed to archive version', { variant: 'error' });
      return null;
    }
  }, [loadVersions, enqueueSnackbar]);

  // Get version by ID
  const getVersion = useCallback(async (versionId: string): Promise<ContentVersion | null> => {
    try {
      return await workflowApi.getVersion(versionId);
    } catch (error) {
      console.error('Failed to get version:', error);
      enqueueSnackbar('Failed to load version details', { variant: 'error' });
      return null;
    }
  }, [enqueueSnackbar]);

  // Compare two versions
  const compareVersions = useCallback(async (
    version1Id: string, 
    version2Id: string
  ) => {
    try {
      return await workflowApi.compareVersions(version1Id, version2Id);
    } catch (error) {
      console.error('Failed to compare versions:', error);
      enqueueSnackbar('Failed to compare versions', { variant: 'error' });
      return null;
    }
  }, [enqueueSnackbar]);

  // Get version statistics
  const getVersionStats = useCallback(() => {
    const totalVersions = state.versions.length;
    const draftCount = state.versions.filter(v => v.version_status === VersionStatus.DRAFT).length;
    const publishedCount = state.versions.filter(v => v.version_status === VersionStatus.PUBLISHED).length;
    const archivedCount = state.versions.filter(v => v.version_status === VersionStatus.ARCHIVED).length;
    
    return {
      total: totalVersions,
      draft: draftCount,
      published: publishedCount,
      archived: archivedCount
    };
  }, [state.versions]);

  // Check if a version can be restored
  const canRestoreVersion = useCallback((version: ContentVersion): boolean => {
    // Can't restore the current version to itself
    if (version.id === state.currentVersion?.id) {
      return false;
    }
    
    // Can restore any version except archived ones
    return version.version_status !== VersionStatus.ARCHIVED;
  }, [state.currentVersion]);

  // Check if a version can be archived
  const canArchiveVersion = useCallback((version: ContentVersion): boolean => {
    // Can't archive published or current draft versions
    return version.version_status !== VersionStatus.PUBLISHED && 
           version.version_status !== VersionStatus.ARCHIVED &&
           version.id !== state.draftVersion?.id;
  }, [state.draftVersion]);

  // Auto-load versions on mount
  useEffect(() => {
    if (autoLoadVersions) {
      loadVersions();
    }
  }, [autoLoadVersions, loadVersions]);

  return {
    // State
    versions: state.versions,
    loading: state.loading,
    currentVersion: state.currentVersion,
    publishedVersion: state.publishedVersion,
    draftVersion: state.draftVersion,
    
    // Actions
    loadVersions,
    createVersion,
    restoreVersion,
    updateVersionMetadata,
    archiveVersion,
    getVersion,
    compareVersions,
    
    // Utilities
    getVersionStats,
    canRestoreVersion,
    canArchiveVersion
  };
};