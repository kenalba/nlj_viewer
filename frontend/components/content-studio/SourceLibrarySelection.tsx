/**
 * Source Library Selection Component
 * Allows users to select documents from their library for content generation
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Checkbox,
  FormControlLabel,
  Button,
  Alert,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  CircularProgress,
  InputAdornment,
  Pagination,
  Stack,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from '@mui/material';
import {
  Description as DocumentIcon,
  PictureAsPdf as PdfIcon,
  Article as DocIcon,
  Slideshow as PptIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Sort as SortIcon,
  Add as AddIcon,
  CheckCircle as ReadyIcon,
  Schedule as ProcessingIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getSourceDocuments, uploadSourceDocument, type SourceDocument } from '../../api/sources';
import { formatBytes, formatDistanceToNow } from '../../utils/formatters';

// Utility function for debouncing search input
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

interface SourceLibrarySelectionProps {
  selectedDocuments: SourceDocument[];
  onSelectionChange: (documents: SourceDocument[]) => void;
}

type SortField = 'name' | 'created_at' | 'file_size' | 'file_type';
type SortDirection = 'asc' | 'desc';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

interface FilterState {
  search: string;
  fileType: string;
  sortField: SortField;
  sortDirection: SortDirection;
}

export const SourceLibrarySelection: React.FC<SourceLibrarySelectionProps> = ({
  selectedDocuments,
  onSelectionChange
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newDocumentDescription, setNewDocumentDescription] = useState('');
  
  // New scalable state management
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 12, // Cards per page - optimal for most screen sizes
    total: 0
  });
  
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    fileType: 'all',
    sortField: 'created_at',
    sortDirection: 'desc'
  });
  
  // Optimized selection state using Set for O(1) lookup
  const selectedDocumentIds = useMemo(
    () => new Set(selectedDocuments.map(d => d.id)),
    [selectedDocuments]
  );

  // Load documents when pagination or filters change
  useEffect(() => {
    loadDocuments();
  }, [pagination.page, pagination.limit, filters]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Calculate offset from page number
      const offset = (pagination.page - 1) * pagination.limit;
      
      // Build query parameters for API call
      const params = {
        limit: pagination.limit,
        offset: offset,
        ...(filters.search && { search: filters.search }),
        ...(filters.fileType !== 'all' && { file_type: filters.fileType })
      };
      
      const response = await getSourceDocuments(params);
      
      // Sort documents client-side for now (could be moved to backend later)
      const sortedDocuments = sortDocuments(response.items, filters.sortField, filters.sortDirection);
      
      setDocuments(sortedDocuments);
      setPagination(prev => ({ ...prev, total: response.total }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  // Helper function for client-side sorting
  const sortDocuments = (docs: SourceDocument[], field: SortField, direction: SortDirection): SourceDocument[] => {
    return [...docs].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (field) {
        case 'name':
          aVal = a.original_filename.toLowerCase();
          bVal = b.original_filename.toLowerCase();
          break;
        case 'created_at':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case 'file_size':
          aVal = a.file_size;
          bVal = b.file_size;
          break;
        case 'file_type':
          aVal = a.file_type;
          bVal = b.file_type;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Debounced search handler to avoid excessive API calls
  const debouncedSearch = useCallback(
    debounce((searchTerm: string) => {
      setFilters(prev => ({ ...prev, search: searchTerm }));
      setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on search
    }, 300),
    []
  );

  // Optimized document toggle using Set lookup
  const handleDocumentToggle = useCallback((document: SourceDocument) => {
    const isSelected = selectedDocumentIds.has(document.id);
    if (isSelected) {
      onSelectionChange(selectedDocuments.filter(d => d.id !== document.id));
    } else {
      onSelectionChange([...selectedDocuments, document]);
    }
  }, [selectedDocuments, selectedDocumentIds, onSelectionChange]);

  // Handle filter changes
  const handleFilterChange = useCallback((filterKey: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [filterKey]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on filter change
  }, []);

  // Handle page change
  const handlePageChange = useCallback((event: React.ChangeEvent<unknown>, newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  }, []);

  // Upload handlers
  const handleUploadClick = () => {
    setUploadDialogOpen(true);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const uploadedDocument = await uploadSourceDocument({
        file,
        description: newDocumentDescription || undefined
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Add to documents list and refresh
      setTimeout(() => {
        setUploadDialogOpen(false);
        setUploading(false);
        setUploadProgress(0);
        setNewDocumentDescription('');
        loadDocuments(); // Refresh the list
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
      setUploadProgress(0);
    }

    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  // Updated select all for current page (more intuitive with pagination)
  const handleSelectAll = useCallback(() => {
    const currentPageDocuments = documents;
    const currentlySelectedFromPage = currentPageDocuments.filter(doc => 
      selectedDocumentIds.has(doc.id)
    );
    
    if (currentlySelectedFromPage.length === currentPageDocuments.length) {
      // Deselect all from current page
      const remainingSelected = selectedDocuments.filter(doc => 
        !currentPageDocuments.some(pageDoc => pageDoc.id === doc.id)
      );
      onSelectionChange(remainingSelected);
    } else {
      // Select all from current page
      const newSelections = currentPageDocuments.filter(doc => 
        !selectedDocumentIds.has(doc.id)
      );
      onSelectionChange([...selectedDocuments, ...newSelections]);
    }
  }, [documents, selectedDocuments, selectedDocumentIds, onSelectionChange]);

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <PdfIcon color="error" />;
      case 'docx':
        return <DocIcon color="primary" />;
      case 'pptx':
        return <PptIcon color="warning" />;
      default:
        return <DocumentIcon />;
    }
  };

  // Calculate total pages
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading your document library...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={loadDocuments}>
          <RefreshIcon sx={{ mr: 1 }} />
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  if (documents.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <UploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          No documents in your library
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Upload documents to your Source Library to use them for content generation.
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate('/app/sources')}
          startIcon={<UploadIcon />}
        >
          Go to Source Library
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Search and Filter Controls */}
      <Box mb={3}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ gap: 2 }}>
          <TextField
            placeholder="Search documents..."
            size="small"
            sx={{ minWidth: 250, flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            onChange={(e) => debouncedSearch(e.target.value)}
          />
          
          <TextField
            select
            size="small"
            value={filters.fileType}
            onChange={(e) => handleFilterChange('fileType', e.target.value)}
            label="File Type"
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="pdf">PDF</MenuItem>
            <MenuItem value="docx">Word</MenuItem>
            <MenuItem value="pptx">PowerPoint</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            value={`${filters.sortField}-${filters.sortDirection}`}
            onChange={(e) => {
              const [field, direction] = e.target.value.split('-') as [SortField, SortDirection];
              handleFilterChange('sortField', field);
              handleFilterChange('sortDirection', direction);
            }}
            label="Sort By"
            sx={{ minWidth: 150 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SortIcon />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value="created_at-desc">Newest First</MenuItem>
            <MenuItem value="created_at-asc">Oldest First</MenuItem>
            <MenuItem value="name-asc">Name A-Z</MenuItem>
            <MenuItem value="name-desc">Name Z-A</MenuItem>
            <MenuItem value="file_size-desc">Largest First</MenuItem>
            <MenuItem value="file_size-asc">Smallest First</MenuItem>
            <MenuItem value="file_type-asc">Type A-Z</MenuItem>
          </TextField>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleUploadClick}
            size="small"
            sx={{ whiteSpace: 'nowrap' }}
          >
            Upload Document
          </Button>
        </Stack>
      </Box>

      {/* Status Bar */}
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          {selectedDocuments.length > 0 && (
            <Chip 
              label={`${selectedDocuments.length} selected`} 
              color="primary" 
              size="small" 
            />
          )}
          
          {filters.fileType !== 'all' && (
            <Chip 
              label={`Filtered: ${filters.fileType.toUpperCase()}`} 
              color="secondary" 
              size="small" 
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* Document Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={documents.length > 0 && documents.every(doc => selectedDocumentIds.has(doc.id))}
                  indeterminate={documents.some(doc => selectedDocumentIds.has(doc.id)) && !documents.every(doc => selectedDocumentIds.has(doc.id))}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Document</TableCell>
              <TableCell align="center">Type</TableCell>
              <TableCell align="center">Size</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((document) => {
              const isSelected = selectedDocumentIds.has(document.id);
              return (
                <TableRow 
                  key={document.id}
                  hover
                  onClick={() => handleDocumentToggle(document)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleDocumentToggle(document)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {getFileIcon(document.file_type)}
                      <Box sx={{ ml: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {document.original_filename}
                        </Typography>
                        {document.summary && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {document.summary.length > 80 
                              ? `${document.summary.substring(0, 80)}...`
                              : document.summary
                            }
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={document.file_type.toUpperCase()} size="small" />
                  </TableCell>
                  <TableCell align="center">
                    {formatBytes(document.file_size)}
                  </TableCell>
                  <TableCell align="center">
                    {document.claude_file_id ? (
                      <Chip 
                        icon={<ReadyIcon />} 
                        label="Ready" 
                        size="small" 
                        color="success" 
                      />
                    ) : (
                      <Chip 
                        icon={<ProcessingIcon />} 
                        label="Processing" 
                        size="small" 
                        color="warning" 
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {formatDistanceToNow(new Date(document.created_at))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={totalPages}
            page={pagination.page}
            onChange={handlePageChange}
            showFirstButton
            showLastButton
            size="large"
            color="primary"
          />
        </Box>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload New Document</DialogTitle>
        <DialogContent>
          <Box py={2}>
            <TextField
              label="Description (optional)"
              value={newDocumentDescription}
              onChange={(e) => setNewDocumentDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Brief description of the document content..."
              sx={{ mb: 3 }}
            />
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.pptx"
              style={{ display: 'none' }}
            />
            
            <Button
              variant="outlined"
              onClick={handleFileSelect}
              startIcon={<UploadIcon />}
              fullWidth
              size="large"
              disabled={uploading}
            >
              Choose File (PDF, Word, PowerPoint)
            </Button>
            
            {uploading && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Uploading document...
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};