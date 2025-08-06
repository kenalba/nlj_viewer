/**
 * Review Overview Tab - Basic content information and metadata
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Card,
  CardContent
} from '@mui/material';
import {
  Person as PersonIcon,
  Schedule as ClockIcon,
  Info as InfoIcon,
  Tag as VersionIcon
} from '@mui/icons-material';
import type { PendingReview } from '../../types/workflow';
import {
  getWorkflowStateColor,
  getWorkflowStateLabel
} from '../../types/workflow';

interface ReviewOverviewTabProps {
  review: PendingReview;
}

export const ReviewOverviewTab: React.FC<ReviewOverviewTabProps> = ({ review }) => {
  const { workflow, content_title, content_description, version_number, creator_name, submitted_at } = review;
  const stateColor = getWorkflowStateColor(workflow.current_state);
  const stateLabel = getWorkflowStateLabel(workflow.current_state);

  return (
    <Box>
      {/* Content Title and Status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
          <Box flex={1}>
            <Typography variant="h4" gutterBottom>
              {content_title}
            </Typography>
            {content_description && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {content_description}
              </Typography>
            )}
          </Box>
          <Chip 
            label={stateLabel}
            size="medium"
            sx={{ 
              backgroundColor: stateColor,
              color: 'white',
              fontWeight: 600,
              ml: 2
            }}
          />
        </Box>

        {/* Metadata Cards */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <PersonIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Creator
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {creator_name}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <VersionIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Version
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  v{version_number}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <ClockIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Submitted
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {submitted_at ? new Date(submitted_at).toLocaleDateString() : 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <InfoIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Workflow ID
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {workflow.id.slice(0, 8)}...
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Additional Details */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon />
          Content Details
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Requires Approval
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {workflow.requires_approval ? 'Yes' : 'No'}
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Auto Publish
            </Typography>
            <Typography variant="body2">
              {workflow.auto_publish ? 'Yes' : 'No'}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Created
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {new Date(workflow.created_at).toLocaleString()}
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Last Updated
            </Typography>
            <Typography variant="body2">
              {new Date(workflow.updated_at).toLocaleString()}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default ReviewOverviewTab;