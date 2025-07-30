/**
 * Simple table component for ContentLibrary using MUI Table
 * Replaces the problematic DataGrid with a more reliable solution
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Checkbox,
  Box,
  Typography
} from '@mui/material';
import type { ContentItem } from '../../api/content';
import type { ContentVersion } from '../../types/workflow';
import { workflowApi } from '../../api/workflow';
import type { User } from '../../api/auth';
import {
  TitleDescriptionCell,
  ContentTypeCell,
  LearningStyleCell,
  CategoryCell,
  DateCell,
  WorkflowStatusCell,
  VersionInfoCell,
  ActionsCell
} from './ContentLibraryCells';

// Memoized table row component to prevent cascading re-renders
interface ContentTableRowProps {
  item: ContentItem;
  isSelected: boolean;
  onRowSelect: (id: string, isSelected: boolean) => void;
  user?: User | null;
  onPlayContent: (item: ContentItem) => void;
  onEditContent: (item: ContentItem) => void;
  versions?: ContentVersion[];
  versionsLoading?: boolean;
}

const ContentTableRow = React.memo(({ 
  item, 
  isSelected, 
  onRowSelect, 
  user, 
  onPlayContent, 
  onEditContent,
  versions,
  versionsLoading
}: ContentTableRowProps) => {
  const handleCheckboxChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onRowSelect(String(item.id), event.target.checked);
  }, [item.id, onRowSelect]);

  return (
    <TableRow
      hover
      selected={isSelected}
      sx={{
        minHeight: '80px',
        '&:hover': {
          backgroundColor: 'action.hover'
        }
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox
          color="primary"
          checked={isSelected}
          onChange={handleCheckboxChange}
          inputProps={{
            'aria-labelledby': `enhanced-table-checkbox-${item.id}`,
          }}
        />
      </TableCell>
      <TableCell sx={{ py: 2 }}>
        <TitleDescriptionCell item={item} />
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <ContentTypeCell item={item} value={item.content_type} />
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <LearningStyleCell item={item} value={item.learning_style} />
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <CategoryCell item={item} value={item.template_category} />
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <Typography variant="body2">
          {item.view_count}
        </Typography>
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <Typography variant="body2">
          {item.completion_count}
        </Typography>
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <DateCell item={item} value={item.created_at} />
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <WorkflowStatusCell item={item} value={item.state} />
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <VersionInfoCell item={item} versions={versions} versionsLoading={versionsLoading} />
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <DateCell item={item} value={item.updated_at} />
      </TableCell>
      <TableCell align="center" sx={{ py: 2 }}>
        <ActionsCell 
          item={item}
          user={user}
          onPlay={onPlayContent}
          onEdit={onEditContent}
        />
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if relevant props changed
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.title === nextProps.item.title &&
    prevProps.item.content_type === nextProps.item.content_type &&
    prevProps.item.state === nextProps.item.state &&
    prevProps.item.updated_at === nextProps.item.updated_at &&
    prevProps.user === nextProps.user &&
    prevProps.versions === nextProps.versions &&
    prevProps.versionsLoading === nextProps.versionsLoading
  );
});

interface ContentTableProps {
  content: ContentItem[];
  selectedIds: Set<string>;
  onSelectionChange: (newSelectedIds: Set<string>) => void;
  user?: User | null;
  onPlayContent: (item: ContentItem) => void;
  onEditContent: (item: ContentItem) => void;
}

export const ContentTable = React.memo(({ 
  content, 
  selectedIds, 
  onSelectionChange,
  user,
  onPlayContent,
  onEditContent
}: ContentTableProps) => {
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(15);
  const [versionsMap, setVersionsMap] = useState<Map<string, ContentVersion[]>>(new Map());
  const [versionsLoading, setVersionsLoading] = useState(false);
  
  // Use ref to avoid re-creating callbacks on every selection change
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  // Batch fetch versions for all content items
  useEffect(() => {
    const fetchAllVersions = async () => {
      if (content.length === 0) return;
      
      setVersionsLoading(true);
      const newVersionsMap = new Map<string, ContentVersion[]>();
      
      try {
        // Batch fetch versions for all content items
        const versionPromises = content.map(async (item) => {
          try {
            const versions = await workflowApi.getContentVersions(String(item.id));
            return { itemId: String(item.id), versions };
          } catch (error) {
            console.error(`Failed to fetch versions for item ${item.id}:`, error);
            return { itemId: String(item.id), versions: [] };
          }
        });
        
        const results = await Promise.all(versionPromises);
        
        results.forEach(({ itemId, versions }) => {
          newVersionsMap.set(itemId, versions);
        });
        
        setVersionsMap(newVersionsMap);
      } catch (error) {
        console.error('Failed to batch fetch versions:', error);
      } finally {
        setVersionsLoading(false);
      }
    };

    fetchAllVersions();
  }, [content]);

  // Handle individual row selection - stable callback reference that won't cause re-renders
  const handleRowSelect = useCallback((id: string, isSelected: boolean) => {
    const newSelectedIds = new Set(selectedIdsRef.current);
    if (isSelected) {
      newSelectedIds.add(id);
    } else {
      newSelectedIds.delete(id);
    }
    onSelectionChangeRef.current(newSelectedIds);
  }, []); // Empty dependency array - callback never changes

  // Ref for content to avoid re-creating callback
  const contentRef = useRef(content);
  contentRef.current = content;

  // Handle select all - stable callback reference
  const handleSelectAll = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelectedIds = new Set(contentRef.current.map(item => String(item.id)));
      onSelectionChangeRef.current(newSelectedIds);
    } else {
      onSelectionChangeRef.current(new Set());
    }
  }, []); // Empty dependency array - callback never changes

  // Calculate pagination
  const paginatedContent = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return content.slice(startIndex, startIndex + rowsPerPage);
  }, [content, page, rowsPerPage]);

  // Selection state calculations
  const selectedCount = selectedIds.size;
  const isAllSelected = content.length > 0 && selectedCount === content.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < content.length;

  // Stable pagination handlers
  const handleChangePage = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  color="primary"
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  inputProps={{
                    'aria-label': 'select all activities',
                  }}
                />
              </TableCell>
              <TableCell sx={{ minWidth: 300 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Title & Description
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 120 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Type
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 120 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Learning Style
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 100 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Category
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 80 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Views
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 90 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Completed
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 100 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Created
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 120 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Review Status
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 100 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Version
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 120 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Last Updated
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 120 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Actions
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedContent.map((item) => (
              <ContentTableRow
                key={item.id}
                item={item}
                isSelected={selectedIds.has(String(item.id))}
                onRowSelect={handleRowSelect}
                user={user}
                onPlayContent={onPlayContent}
                onEditContent={onEditContent}
                versions={versionsMap.get(String(item.id))}
                versionsLoading={versionsLoading}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 15, 25, 50]}
        component="div"
        count={content.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
});