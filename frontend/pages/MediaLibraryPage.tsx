/**
 * Media Library Page
 * Browse and manage generated media content (podcasts, videos, etc.)
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Fab,
  Alert,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Stack,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  Image as ImageIcon,
  Dashboard as InfographicIcon,
  FilterList as FilterIcon,
  ViewModule as CardViewIcon,
  TableRows as TableViewIcon,
  PlayArrow as PlayIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { 
  getMediaItems, 
  deleteMediaItem, 
  createMediaShare,
  formatDuration,
  formatFileSize,
  getMediaStateColor,
  getMediaTypeIcon,
  type MediaItem,
  type MediaListResponse 
} from '../api/media';
import { LoadingSpinner } from '../shared/LoadingSpinner';

const MediaLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMediaType, setSelectedMediaType] = useState<string>('');
  const [selectedMediaState, setSelectedMediaState] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('nlj-media-view-mode');
    return (saved === 'card' || saved === 'table') ? saved : 'table';
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const queryClient = useQueryClient();

  // Fetch media items with search and filtering
  const { data: mediaResponse, isLoading, error } = useQuery({
    queryKey: ['media', { search: searchQuery, media_type: selectedMediaType, media_state: selectedMediaState }],
    queryFn: () => getMediaItems({
      search: searchQuery || undefined,
      media_type: selectedMediaType || undefined,
      media_state: selectedMediaState || undefined,
      limit: 50,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMediaItem,
    onSuccess: () => {
      setSuccessMessage('Media item deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setAnchorEl(null);
      setSelectedMedia(null);
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.detail || 'Failed to delete media item');
      setAnchorEl(null);
      setSelectedMedia(null);
    },
  });

  const shareMutation = useMutation({
    mutationFn: createMediaShare,
    onSuccess: (shareData) => {
      setSuccessMessage(`Share link created: ${shareData.share_url}`);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setAnchorEl(null);
      setSelectedMedia(null);
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.detail || 'Failed to create share link');
      setAnchorEl(null);
      setSelectedMedia(null);
    },
  });

  const handleMediaClick = (media: MediaItem) => {
    navigate(`/app/media/${media.id}`);
  };

  const handleGenerateNew = () => {
    navigate('/app/generate-podcast');
  };

  const handleViewModeChange = (event: React.MouseEvent<HTMLElement>, newView: 'card' | 'table' | null) => {
    if (newView) {
      setViewMode(newView);
      localStorage.setItem('nlj-media-view-mode', newView);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, media: MediaItem) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedMedia(media);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMedia(null);
  };

  const handleEditMedia = () => {
    if (selectedMedia) {
      navigate(`/app/media/${selectedMedia.id}`);
    }
    handleMenuClose();
  };

  const handleDeleteMedia = () => {
    if (selectedMedia && window.confirm(`Are you sure you want to delete "${selectedMedia.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate(selectedMedia.id);
    } else {
      handleMenuClose();
    }
  };

  const handleShareMedia = () => {
    if (selectedMedia) {
      shareMutation.mutate(selectedMedia.id);
    }
  };

  const getMediaTypeIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'podcast':
      case 'audio_summary':
        return <AudioIcon />;
      case 'video':
        return <VideoIcon />;
      case 'image':
        return <ImageIcon />;
      case 'infographic':
        return <InfographicIcon />;
      default:
        return <AudioIcon />;
    }
  };

  const renderMediaCard = (media: MediaItem) => (
    <Card 
      key={media.id}
      sx={{ 
        cursor: 'pointer',
        '&:hover': { boxShadow: 2 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={() => handleMediaClick(media)}
    >
      {/* Progress bar for generating media */}
      {media.media_state === 'generating' && (
        <LinearProgress color="primary" />
      )}
      
      <Box sx={{ p: 2, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
            {getMediaTypeIcon(media.media_type)}
          </Avatar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              label={media.media_state}
              color={getMediaStateColor(media.media_state)}
              size="small"
            />
            <IconButton
              size="small"
              onClick={(e) => handleMenuClick(e, media)}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Typography variant="h6" gutterBottom noWrap>
          {media.title}
        </Typography>
        
        {media.description && (
          <Typography variant="body2" color="text.secondary" paragraph>
            {media.description.length > 100 ? `${media.description.slice(0, 100)}...` : media.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          <Chip label={media.media_type.toUpperCase()} size="small" variant="outlined" />
          {media.duration && (
            <Chip label={formatDuration(media.duration)} size="small" variant="outlined" />
          )}
          {media.file_size && (
            <Chip label={formatFileSize(media.file_size)} size="small" variant="outlined" />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
          <PlayIcon fontSize="small" />
          <Typography variant="caption">
            {media.play_count} plays
          </Typography>
          <CalendarIcon fontSize="small" sx={{ ml: 1 }} />
          <Typography variant="caption">
            {new Date(media.created_at).toLocaleDateString()}
          </Typography>
        </Box>
      </Box>
    </Card>
  );

  const mediaTypes = ['podcast', 'video', 'image', 'infographic'];
  const mediaStates = ['generating', 'completed', 'failed'];
  const mediaItems = mediaResponse?.items || [];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Failed to load media library. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Media Library
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your generated podcasts, videos, and media content
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleGenerateNew}
          sx={{ height: 'fit-content' }}
        >
          Generate Media
        </Button>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={3} md={2}>
            <FormControl fullWidth>
              <InputLabel>Media Type</InputLabel>
              <Select
                value={selectedMediaType}
                onChange={(e) => setSelectedMediaType(e.target.value)}
                label="Media Type"
              >
                <MenuItem value="">All Types</MenuItem>
                {mediaTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={selectedMediaState}
                onChange={(e) => setSelectedMediaState(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                {mediaStates.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state.charAt(0).toUpperCase() + state.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {mediaResponse?.total || 0} items
              </Typography>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={handleViewModeChange}
                aria-label="view mode"
                size="small"
              >
                <ToggleButton value="card" aria-label="card view">
                  <CardViewIcon sx={{ mr: 0.5 }} />
                  Cards
                </ToggleButton>
                <ToggleButton value="table" aria-label="table view">
                  <TableViewIcon sx={{ mr: 0.5 }} />
                  Table
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Media Display */}
      {mediaItems.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <AudioIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No media found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {searchQuery || selectedMediaType || selectedMediaState
              ? 'Try adjusting your search or filters'
              : 'Generate your first podcast or media content to get started'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleGenerateNew}
          >
            Generate Media
          </Button>
        </Card>
      ) : viewMode === 'card' ? (
        <Grid container spacing={3}>
          {mediaItems.map((media) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={media.id}>
              {renderMediaCard(media)}
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Media</TableCell>
                  <TableCell align="center">Type</TableCell>
                  <TableCell align="center">Duration</TableCell>
                  <TableCell align="center">Size</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Created</TableCell>
                  <TableCell align="center">Plays</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mediaItems.map((media) => (
                  <TableRow
                    key={media.id}
                    hover
                    onClick={() => handleMediaClick(media)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {getMediaTypeIcon(media.media_type)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" noWrap>
                            {media.title}
                          </Typography>
                          {media.description && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {media.description.slice(0, 50)}...
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={media.media_type.toUpperCase()} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {media.duration ? formatDuration(media.duration) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {media.file_size ? formatFileSize(media.file_size) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={media.media_state}
                        color={getMediaStateColor(media.media_state)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {new Date(media.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {media.play_count}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        onClick={(e) => handleMenuClick(e, media)}
                        size="small"
                        disabled={deleteMutation.isPending}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleEditMedia}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        {selectedMedia?.media_state === 'completed' && (
          <MenuItem onClick={handleShareMedia}>
            <ListItemIcon>
              <ShareIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Share</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleDeleteMedia} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Floating Action Button for mobile */}
      <Fab
        color="primary"
        aria-label="generate"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: { xs: 'flex', sm: 'none' },
        }}
        onClick={handleGenerateNew}
      >
        <AddIcon />
      </Fab>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
      >
        <Alert severity="success" onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage('')}
      >
        <Alert severity="error" onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MediaLibraryPage;