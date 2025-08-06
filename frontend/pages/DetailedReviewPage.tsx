/**
 * Detailed Review Page - Full-screen tabbed interface for comprehensive content review
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  IconButton,
  Container,
  Paper,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Info as OverviewIcon,
  PlayArrow as PlayIcon,
  Visibility as AuditIcon,
  History as HistoryIcon,
  RateReview as ReviewIcon
} from '@mui/icons-material';
import { workflowApi } from '../api/workflow';
import type { PendingReview } from '../types/workflow';
import { isMultiStageWorkflow } from '../types/workflow';
import { useAuth } from '../contexts/AuthContext';

// Import modular components
import { ReviewOverviewAndPreviewTab } from '../components/review/ReviewOverviewAndPreviewTab';
import { RedesignedContentAuditTab } from '../components/review/RedesignedContentAuditTab';
import { ReviewHistoryTab } from '../components/review/ReviewHistoryTab';
import { EnhancedReviewActionsPanel } from '../components/review/EnhancedReviewActionsPanel';
import { MultiStageWorkflowPanel } from '../components/review/MultiStageWorkflowPanel';
import { MultiStageReviewActionsPanel } from '../components/review/MultiStageReviewActionsPanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ height: '100%' }}>
      {value === index && (
        <Box sx={{ py: 3, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const DetailedReviewPage: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const { user } = useAuth();
  
  // Extract workflowId from URL path since useParams might not be working with our routing setup
  const pathSegments = location.pathname.split('/');
  const reviewIndex = pathSegments.indexOf('review');
  const workflowId = reviewIndex !== -1 ? pathSegments[reviewIndex + 1] : undefined;
  
  console.log('DetailedReviewPage - params:', params);
  console.log('DetailedReviewPage - location.pathname:', location.pathname);
  console.log('DetailedReviewPage - extracted workflowId:', workflowId);
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(0);
  const [review, setReview] = useState<PendingReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('DetailedReviewPage useEffect - workflowId:', workflowId);
    if (workflowId) {
      loadReviewData(workflowId);
    } else {
      console.error('No workflowId provided to DetailedReviewPage');
      setError('No workflow ID provided');
      setLoading(false);
    }
  }, [workflowId]);

  const loadReviewData = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading review data for workflow ID:', id);
      
      // Get all pending reviews and find the one with matching workflow ID
      console.log('Calling workflowApi.getPendingReviews()...');
      const pendingReviews = await workflowApi.getPendingReviews();
      console.log('Got pending reviews:', pendingReviews.length, pendingReviews);
      
      const reviewData = pendingReviews.find(r => r.workflow.id === id);
      console.log('Looking for workflow ID:', id);
      console.log('Available workflow IDs:', pendingReviews.map(r => r.workflow.id));
      console.log('Found review data:', reviewData ? 'yes' : 'no', reviewData);
      
      if (!reviewData) {
        // Show available IDs for debugging
        const availableIds = pendingReviews.map(r => r.workflow.id).join(', ');
        throw new Error(`Review not found. Looking for: ${id}. Available: ${availableIds}`);
      }
      
      setReview(reviewData);
      console.log('Successfully set review data');
    } catch (err: any) {
      console.error('Failed to load review data:', err);
      setError(err.message || 'Failed to load review data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleBack = () => {
    navigate('/app/approvals');
  };

  const handleReviewComplete = () => {
    // Navigate back to approvals instead of reloading
    navigate('/app/approvals');
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="60vh" gap={2}>
        <CircularProgress size={48} />
        <Typography variant="h6">Loading review details...</Typography>
      </Box>
    );
  }

  if (error || !review) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert 
          severity="error" 
          action={
            <IconButton color="inherit" onClick={handleBack}>
              <BackIcon />
            </IconButton>
          }
        >
          {error || 'Review not found'}
        </Alert>
      </Container>
    );
  }

  const isMultiStage = isMultiStageWorkflow(review.workflow);
  
  const tabConfigs = [
    { label: 'Overview & Preview', icon: <OverviewIcon fontSize="small" />, component: <ReviewOverviewAndPreviewTab review={review} /> },
    { label: 'Content Audit', icon: <AuditIcon fontSize="small" />, component: <RedesignedContentAuditTab review={review} /> },
    { label: 'Review History', icon: <HistoryIcon fontSize="small" />, component: <ReviewHistoryTab review={review} /> },
    ...(isMultiStage ? [{ 
      label: 'Workflow Progress', 
      icon: <ReviewIcon fontSize="small" />, 
      component: <MultiStageWorkflowPanel workflow={review.workflow as any} compact={false} /> 
    }] : [])
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <AppBar position="static" elevation={1} sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
        <Toolbar>
          <IconButton edge="start" onClick={handleBack} sx={{ mr: 2 }}>
            <BackIcon />
          </IconButton>
          
          <Box sx={{ flexGrow: 1 }}>
            <Breadcrumbs sx={{ mb: 0.5 }}>
              <Link color="inherit" onClick={handleBack} sx={{ cursor: 'pointer' }}>
                Approvals
              </Link>
              <Typography color="text.primary">
                Detailed Review
              </Typography>
            </Breadcrumbs>
            <Typography variant="h6" component="div">
              {review.content_title}
            </Typography>
          </Box>

          <ReviewIcon sx={{ mr: 1, color: 'primary.main' }} />
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Side - Tabs and Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab Navigation */}
          <Paper square elevation={1} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: 2 }}
            >
              {tabConfigs.map((tab, index) => (
                <Tab 
                  key={index}
                  label={tab.label}
                  icon={tab.icon}
                  iconPosition="start"
                  sx={{ minHeight: 48, textTransform: 'none' }}
                />
              ))}
            </Tabs>
          </Paper>

          {/* Tab Content */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <Container maxWidth="lg" sx={{ height: '100%' }}>
              {tabConfigs.map((tab, index) => (
                <TabPanel key={index} value={currentTab} index={index}>
                  {tab.component}
                </TabPanel>
              ))}
            </Container>
          </Box>
        </Box>

        {/* Right Sidebar - Review Actions */}
        <Box sx={{ 
          width: 420, 
          borderLeft: 1, 
          borderColor: 'divider', 
          bgcolor: 'grey.50',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100%',
          minHeight: 0
        }}>
          <Box sx={{ 
            p: 3, 
            borderBottom: 1, 
            borderColor: 'divider',
            bgcolor: 'background.paper',
            flexShrink: 0
          }}>
            <Typography variant="h6" sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              fontWeight: 600 
            }}>
              <ReviewIcon color="primary" />
              Review Actions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Evaluate and provide feedback
            </Typography>
          </Box>
          
          <Box sx={{ flex: 1, overflow: 'auto', p: 3, minHeight: 0 }}>
            {isMultiStage ? (
              <MultiStageReviewActionsPanel
                workflow={review.workflow as any}
                currentUserId={user?.id || ''}
                onReviewComplete={handleReviewComplete}
                compact={false}
              />
            ) : (
              <EnhancedReviewActionsPanel 
                review={review}
                onReviewComplete={handleReviewComplete}
                compact={false}
              />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default DetailedReviewPage;