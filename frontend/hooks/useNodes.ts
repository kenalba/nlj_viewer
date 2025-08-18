/**
 * Nodes CRUD Operations Hook
 * Custom hook for managing node data with CRUD operations, filtering, and caching
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Node,
  NodesListParams,
  NodesListResponse,
  getNodes,
  getNode,
  createNode,
  updateNode,
  deleteNode,
  searchNodes,
  getNodesByContentHash,
} from '../services/nodeService';

export interface UseNodesResult {
  nodes: Node[];
  total: number;
  isLoading: boolean;
  error: string | null;
  currentParams: NodesListParams;
  refetch: () => Promise<void>;
  updateParams: (params: Partial<NodesListParams>) => void;
  createNewNode: (nodeData: Omit<Node, 'id' | 'created_at' | 'updated_at'>) => Promise<Node>;
  updateExistingNode: (nodeId: string, nodeData: Partial<Node>) => Promise<Node>;
  removeNode: (nodeId: string) => Promise<void>;
  searchNodesQuery: (query: string, searchParams?: any) => Promise<void>;
  clearSearch: () => void;
  isSearchMode: boolean;
}

/**
 * Hook for managing paginated nodes list with filtering and CRUD operations
 */
export const useNodes = (initialParams: NodesListParams = {}): UseNodesResult => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<NodesListParams>({
    limit: 20,
    offset: 0,
    sort_by: 'updated_at',
    sort_order: 'desc',
    ...initialParams,
  });
  const [isSearchMode, setIsSearchMode] = useState(false);

  const fetchNodes = useCallback(async (params = currentParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getNodes(params);
      setNodes(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('Error fetching nodes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch nodes');
      setNodes([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentParams]);

  const updateParams = useCallback((newParams: Partial<NodesListParams>) => {
    setCurrentParams(prev => ({
      ...prev,
      ...newParams,
      // Reset offset when changing filters or search
      offset: newParams.search !== undefined || 
              newParams.node_type !== undefined ||
              newParams.sort_by !== undefined ||
              newParams.sort_order !== undefined 
                ? 0 
                : newParams.offset ?? prev.offset,
    }));
    setIsSearchMode(false);
  }, []);

  const searchNodesQuery = useCallback(async (query: string, searchParams: any = {}) => {
    if (!query.trim()) {
      setIsSearchMode(false);
      await fetchNodes();
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsSearchMode(true);

    try {
      const response = await searchNodes(query, {
        limit: currentParams.limit,
        ...searchParams,
      });
      setNodes(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('Error searching nodes:', err);
      setError(err instanceof Error ? err.message : 'Failed to search nodes');
      setNodes([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentParams.limit, fetchNodes]);

  const clearSearch = useCallback(() => {
    setIsSearchMode(false);
    fetchNodes();
  }, [fetchNodes]);

  const createNewNode = useCallback(async (nodeData: Omit<Node, 'id' | 'created_at' | 'updated_at'>): Promise<Node> => {
    try {
      const newNode = await createNode(nodeData);
      // Refresh the list to include the new node
      await fetchNodes();
      return newNode;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create node';
      setError(message);
      throw new Error(message);
    }
  }, [fetchNodes]);

  const updateExistingNode = useCallback(async (nodeId: string, nodeData: Partial<Node>): Promise<Node> => {
    try {
      const updatedNode = await updateNode(nodeId, nodeData);
      // Update the node in the current list
      setNodes(prevNodes => 
        prevNodes.map(node => 
          node.id === nodeId ? updatedNode : node
        )
      );
      return updatedNode;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update node';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const removeNode = useCallback(async (nodeId: string): Promise<void> => {
    try {
      await deleteNode(nodeId);
      // Remove the node from the current list and update total
      setNodes(prevNodes => prevNodes.filter(node => node.id !== nodeId));
      setTotal(prevTotal => prevTotal - 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete node';
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Fetch nodes when params change
  useEffect(() => {
    if (!isSearchMode) {
      fetchNodes();
    }
  }, [fetchNodes, isSearchMode]);

  return {
    nodes,
    total,
    isLoading,
    error,
    currentParams,
    refetch: fetchNodes,
    updateParams,
    createNewNode,
    updateExistingNode,
    removeNode,
    searchNodesQuery,
    clearSearch,
    isSearchMode,
  };
};

export interface UseNodeResult {
  node: Node | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateNodeData: (nodeData: Partial<Node>) => Promise<Node>;
}

/**
 * Hook for managing a single node's data
 */
export const useNode = (nodeId: string | null): UseNodeResult => {
  const [node, setNode] = useState<Node | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNode = useCallback(async () => {
    if (!nodeId) {
      console.log('useNode: No nodeId provided');
      return;
    }

    console.log('useNode: Fetching node with ID:', nodeId);
    setIsLoading(true);
    setError(null);

    try {
      const nodeData = await getNode(nodeId);
      console.log('useNode: Successfully fetched node:', nodeData);
      setNode(nodeData);
    } catch (err) {
      console.error('useNode: Error fetching node:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch node');
      setNode(null);
    } finally {
      setIsLoading(false);
    }
  }, [nodeId]);

  const updateNodeData = useCallback(async (nodeData: Partial<Node>): Promise<Node> => {
    if (!nodeId) throw new Error('No node ID provided');

    try {
      const updatedNode = await updateNode(nodeId, nodeData);
      setNode(updatedNode);
      return updatedNode;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update node';
      setError(message);
      throw new Error(message);
    }
  }, [nodeId]);

  useEffect(() => {
    if (nodeId) {
      fetchNode();
    } else {
      setNode(null);
      setError(null);
      setIsLoading(false);
    }
  }, [fetchNode, nodeId]);

  return {
    node,
    isLoading,
    error,
    refetch: fetchNode,
    updateNodeData,
  };
};

export interface UseNodeDeduplicationResult {
  duplicates: Node[];
  isLoading: boolean;
  error: string | null;
  checkDuplicates: (contentHash: string) => Promise<void>;
  clear: () => void;
}

/**
 * Hook for finding duplicate nodes by content hash
 */
export const useNodeDeduplication = (): UseNodeDeduplicationResult => {
  const [duplicates, setDuplicates] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkDuplicates = useCallback(async (contentHash: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const duplicateNodes = await getNodesByContentHash(contentHash);
      setDuplicates(duplicateNodes);
    } catch (err) {
      console.error('Error checking for duplicates:', err);
      setError(err instanceof Error ? err.message : 'Failed to check for duplicates');
      setDuplicates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setDuplicates([]);
    setError(null);
  }, []);

  return {
    duplicates,
    isLoading,
    error,
    checkDuplicates,
    clear,
  };
};

/**
 * Utility hook for node filtering and sorting
 */
export const useNodeFilters = (nodes: Node[]) => {
  return useMemo(() => {
    const nodeTypes = Array.from(new Set(nodes.map(node => node.node_type)));
    
    const difficultyLevels = Array.from(
      new Set(nodes.map(node => node.difficulty_level).filter(level => level !== null && level !== undefined))
    ).sort((a, b) => a! - b!);

    const createdByUsers = Array.from(new Set(nodes.map(node => node.created_by)));

    const filterByType = (type: string) => nodes.filter(node => node.node_type === type);
    
    const filterByDifficulty = (level: number) => nodes.filter(node => node.difficulty_level === level);
    
    const filterBySuccessRate = (minRate: number, maxRate?: number) => 
      nodes.filter(node => {
        if (!node.success_rate) return false;
        const rate = node.success_rate * 100; // Convert to percentage
        return maxRate ? rate >= minRate && rate <= maxRate : rate >= minRate;
      });

    const sortByPerformance = (order: 'asc' | 'desc' = 'desc') =>
      [...nodes].sort((a, b) => {
        const aRate = a.success_rate || 0;
        const bRate = b.success_rate || 0;
        return order === 'desc' ? bRate - aRate : aRate - bRate;
      });

    const sortByUsage = (order: 'asc' | 'desc' = 'desc') =>
      [...nodes].sort((a, b) => {
        // This would need to be enhanced with actual usage counts from the API
        return order === 'desc' ? 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() :
          new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      });

    return {
      nodeTypes,
      difficultyLevels,
      createdByUsers,
      filterByType,
      filterByDifficulty,
      filterBySuccessRate,
      sortByPerformance,
      sortByUsage,
    };
  }, [nodes]);
};

export default {
  useNodes,
  useNode,
  useNodeDeduplication,
  useNodeFilters,
};