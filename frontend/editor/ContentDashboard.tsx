/**
 * Content Dashboard
 * Main interface for managing NLJ content items
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { NLJScenario } from '../types/nlj';

interface ContentItem {
  id: string;
  name: string;
  description?: string;
  state: 'draft' | 'pending_sgm' | 'pending_legal' | 'pending_compliance' | 'approved' | 'published';
  created_at: string;
  updated_at: string;
  created_by: string;
  nlj_data: NLJScenario;
}

interface ContentDashboardProps {
  onEditScenario: (scenario: NLJScenario) => void;
}

// Mock data for development
const mockContentItems: ContentItem[] = [
  {
    id: '1',
    name: 'Sales Training Scenario',
    description: 'Interactive sales training with customer objection handling',
    state: 'draft',
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2024-01-22T15:30:00Z',
    created_by: 'admin',
    nlj_data: {
      id: '1',
      name: 'Sales Training Scenario',
      nodes: [],
      links: [],
      orientation: 'vertical',
      activityType: 'training',
    },
  },
  {
    id: '2',
    name: 'Product Knowledge Quiz',
    description: 'Comprehensive product knowledge assessment',
    state: 'pending_sgm',
    created_at: '2024-01-19T09:15:00Z',
    updated_at: '2024-01-21T11:20:00Z',
    created_by: 'admin',
    nlj_data: {
      id: '2',
      name: 'Product Knowledge Quiz',
      nodes: [],
      links: [],
      orientation: 'vertical',
      activityType: 'assessment',
    },
  },
];

const getStateColor = (state: ContentItem['state']) => {
  switch (state) {
    case 'draft': return 'default';
    case 'pending_sgm': return 'warning';
    case 'pending_legal': return 'info';
    case 'pending_compliance': return 'secondary';
    case 'approved': return 'success';
    case 'published': return 'primary';
    default: return 'default';
  }
};

const getStateLabel = (state: ContentItem['state']) => {
  switch (state) {
    case 'draft': return 'Draft';
    case 'pending_sgm': return 'SGM Review';
    case 'pending_legal': return 'Legal Review';
    case 'pending_compliance': return 'Compliance Review';
    case 'approved': return 'Approved';
    case 'published': return 'Published';
    default: return state;
  }
};

export const ContentDashboard: React.FC<ContentDashboardProps> = ({ onEditScenario }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [contentItems] = useState<ContentItem[]>(mockContentItems);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newContentName, setNewContentName] = useState('');
  const [newContentDescription, setNewContentDescription] = useState('');

  const filteredItems = contentItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateContent = () => {
    if (!newContentName.trim()) return;

    const newScenario: NLJScenario = {
      id: Date.now().toString(),
      name: newContentName,
      nodes: [],
      links: [],
      orientation: 'vertical',
      activityType: 'training',
    };

    // Navigate to flow editor with new scenario
    onEditScenario(newScenario);
    navigate('/editor/flow-editor');
    
    setCreateDialogOpen(false);
    setNewContentName('');
    setNewContentDescription('');
  };

  const handleEditContent = (item: ContentItem) => {
    onEditScenario(item.nlj_data);
    navigate('/editor/flow-editor');
  };

  const handlePlayContent = (item: ContentItem) => {
    // Store scenario in localStorage and navigate to player
    localStorage.setItem(`scenario_${item.id}`, JSON.stringify(item.nlj_data));
    navigate('/player');
  };

  const canEdit = (item: ContentItem) => {
    return item.created_by === user?.username || user?.role === 'admin';
  };

  const canReview = (item: ContentItem) => {
    const userRole = user?.role;
    if (userRole === 'admin') return true;
    
    switch (item.state) {
      case 'pending_sgm': return userRole === 'approver';
      case 'pending_legal': return userRole === 'reviewer';
      case 'pending_compliance': return userRole === 'reviewer';
      default: return false;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Content Management
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Create, edit, and manage NLJ learning content
        </Typography>
      </Box>

      {/* Search Bar */}
      <Box mb={3}>
        <TextField
          fullWidth
          placeholder="Search content..."
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
      </Box>

      {/* Content Grid */}
      <Grid container spacing={3}>
        {filteredItems.map((item) => (
          <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" component="h2" noWrap>
                    {item.name}
                  </Typography>
                  <Chip
                    label={getStateLabel(item.state)}
                    color={getStateColor(item.state)}
                    size="small"
                  />
                </Box>
                
                {item.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {item.description}
                  </Typography>
                )}

                <Typography variant="caption" color="text.secondary">
                  Created: {new Date(item.created_at).toLocaleDateString()}
                </Typography>
                <br />
                <Typography variant="caption" color="text.secondary">
                  Updated: {new Date(item.updated_at).toLocaleDateString()}
                </Typography>
              </CardContent>

              <CardActions>
                <Button
                  size="small"
                  startIcon={<PlayIcon />}
                  onClick={() => handlePlayContent(item)}
                >
                  Play
                </Button>
                
                {canEdit(item) && (
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleEditContent(item)}
                  >
                    Edit
                  </Button>
                )}

                {canReview(item) && (
                  <Button
                    size="small"
                    color="primary"
                  >
                    Review
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchQuery ? 'No content found' : 'No content created yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery ? 'Try adjusting your search terms' : 'Create your first piece of content to get started'}
          </Typography>
        </Box>
      )}

      {/* Create FAB */}
      <Fab
        color="primary"
        aria-label="create content"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setCreateDialogOpen(true)}
      >
        <AddIcon />
      </Fab>

      {/* Create Content Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Content</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Content Name"
            fullWidth
            variant="outlined"
            value={newContentName}
            onChange={(e) => setNewContentName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (Optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newContentDescription}
            onChange={(e) => setNewContentDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateContent}
            variant="contained"
            disabled={!newContentName.trim()}
          >
            Create & Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};