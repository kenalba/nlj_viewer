/**
 * xAPI Results Screen
 * 
 * Displays comprehensive xAPI event tracking results after activity completion.
 * Shows all captured learning events with export capabilities.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  IconButton,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Container,
} from '@mui/material';
import {
  Download,
  InsertChart,
  Visibility,
  CheckCircle,
  ErrorOutline,
  PlayCircleOutline,
  StopCircle,
  QuestionAnswer,
  Assignment,
  ArrowBack,
  DataObject,
  TableView,
  FileDownload,
} from '@mui/icons-material';
import { useXAPI } from '../contexts/XAPIContext';
import type { XAPIStatement } from '../xapi';

interface XAPIResultsScreenProps {
  onBack: () => void;
  scenarioName: string;
}

export const XAPIResultsScreen: React.FC<XAPIResultsScreenProps> = ({ 
  onBack, 
  scenarioName 
}) => {
  const theme = useTheme();
  const {
    statements,
    totalEvents,
    sessionId,
    lastEventTime,
    exportJSON,
    exportCSV,
    isEnabled
  } = useXAPI();
  
  const [selectedStatement, setSelectedStatement] = useState<XAPIStatement | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'raw'>('summary');

  // Analytics calculations
  const analyticsData = React.useMemo(() => {
    const eventTypes = statements.reduce((acc, stmt) => {
      const verbId = stmt.verb.id;
      acc[verbId] = (acc[verbId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Detect activity type based on statements
    const hasAnsweredQuestions = statements.some(stmt => 
      stmt.verb.id.includes('answered') && stmt.result?.success !== undefined
    );
    const hasSurveyResponses = statements.some(stmt => 
      stmt.verb.id.includes('responded') && stmt.object?.id?.includes('survey')
    );
    
    const activityType = hasSurveyResponses ? 'survey' : hasAnsweredQuestions ? 'assessment' : 'training';
    
    const questionEvents = statements.filter(stmt => 
      stmt.verb.id.includes('answered')
    );
    
    const surveyEvents = statements.filter(stmt => 
      stmt.verb.id.includes('responded') && stmt.object?.id?.includes('survey')
    );
    
    const correctAnswers = questionEvents.filter(stmt => 
      stmt.result?.success === true
    ).length;
    
    const totalQuestions = questionEvents.length;
    const totalSurveyResponses = surveyEvents.length;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    
    const totalDuration = statements.reduce((acc, stmt) => {
      if (stmt.result?.duration) {
        // Parse ISO 8601 duration (PT30S -> 30 seconds)
        const match = stmt.result.duration.match(/PT(\d+)S/);
        if (match) {
          acc += parseInt(match[1]);
        }
      }
      return acc;
    }, 0);
    
    return {
      eventTypes,
      activityType,
      totalQuestions,
      totalSurveyResponses,
      correctAnswers,
      accuracy,
      totalDuration,
      sessionDuration: lastEventTime ? 
        Math.round((lastEventTime.getTime() - new Date(statements[0]?.timestamp || '').getTime()) / 1000) : 0
    };
  }, [statements, lastEventTime]);

  const handleExport = useCallback((format: 'json' | 'csv') => {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `xapi_statements_${scenarioName}_${timestamp}`;
    
    let content: string;
    let mimeType: string;
    let extension: string;
    
    if (format === 'json') {
      content = exportJSON();
      mimeType = 'application/json';
      extension = 'json';
    } else {
      content = exportCSV();
      mimeType = 'text/csv';
      extension = 'csv';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setExportDialogOpen(false);
  }, [exportJSON, exportCSV, scenarioName]);

  const getVerbIcon = (verbId: string) => {
    if (verbId.includes('launched')) return <PlayCircleOutline />;
    if (verbId.includes('completed')) return <CheckCircle />;
    if (verbId.includes('answered')) return <QuestionAnswer />;
    if (verbId.includes('failed')) return <ErrorOutline />;
    if (verbId.includes('suspended')) return <StopCircle />;
    return <Assignment />;
  };

  const getVerbColor = (verbId: string): 'primary' | 'success' | 'info' | 'error' | 'warning' | 'default' => {
    if (verbId.includes('launched')) return 'primary';
    if (verbId.includes('completed')) return 'success';
    if (verbId.includes('answered')) return 'info';
    if (verbId.includes('failed')) return 'error';
    if (verbId.includes('suspended')) return 'warning';
    return 'default';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isEnabled) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          xAPI tracking is not enabled for this session.
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={onBack}>
          Back to Activity
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button 
          startIcon={<ArrowBack />} 
          onClick={onBack}
          sx={{ mb: 2 }}
        >
          Back to Activity
        </Button>
        
        <Typography gutterBottom>
          xAPI Learning Analytics
        </Typography>
        
        <Typography color="text.secondary" gutterBottom>
          {scenarioName} • {analyticsData.activityType.charAt(0).toUpperCase() + analyticsData.activityType.slice(1)} • Session: {sessionId.split('-')[0]}
        </Typography>
        
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Chip 
            label={`${totalEvents} Events`} 
            color="primary" 
            
          />
          {analyticsData.activityType === 'survey' ? (
            <Chip 
              label={`${analyticsData.totalSurveyResponses} Responses`} 
              color="success"
              
            />
          ) : (
            <Chip 
              label={`${analyticsData.accuracy.toFixed(1)}% Accuracy`} 
              color={analyticsData.accuracy >= 70 ? 'success' : 'warning'}
              
            />
          )}
          <Chip 
            label={`${formatDuration(analyticsData.sessionDuration)} Duration`} 
            color="info"
            
          />
        </Stack>
      </Box>

      {/* View Mode Toggle */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1}>
          <Button
            variant={viewMode === 'summary' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('summary')}
            startIcon={<InsertChart />}
          >
            Summary
          </Button>
          <Button
            variant={viewMode === 'detailed' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('detailed')}
            startIcon={<TableView />}
          >
            Detailed
          </Button>
          <Button
            variant={viewMode === 'raw' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('raw')}
            startIcon={<DataObject />}
          >
            Raw Data
          </Button>
          <Button
            
            onClick={() => setExportDialogOpen(true)}
            startIcon={<FileDownload />}
          >
            Export
          </Button>
        </Stack>
      </Box>

      {/* Summary View */}
      {viewMode === 'summary' && (
        <Stack spacing={3}>
          {/* Analytics Cards */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography gutterBottom>
                  {analyticsData.activityType === 'survey' ? 'Response Summary' : 'Performance Summary'}
                </Typography>
                <Stack spacing={2}>
                  {analyticsData.activityType === 'survey' ? (
                    <>
                      <Box>
                        <Typography color="text.secondary">
                          Survey Responses
                        </Typography>
                        <Typography >
                          {analyticsData.totalSurveyResponses}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography color="text.secondary">
                          Completion Rate
                        </Typography>
                        <Typography color="success.main">
                          100%
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box>
                        <Typography color="text.secondary">
                          Questions Answered
                        </Typography>
                        <Typography >
                          {analyticsData.correctAnswers}/{analyticsData.totalQuestions}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography color="text.secondary">
                          Accuracy Rate
                        </Typography>
                        <Typography color={analyticsData.accuracy >= 70 ? 'success.main' : 'warning.main'}>
                          {analyticsData.accuracy.toFixed(1)}%
                        </Typography>
                      </Box>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography gutterBottom>
                  Activity Overview
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography color="text.secondary">
                      Total Events
                    </Typography>
                    <Typography >
                      {totalEvents}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary">
                      Session Duration
                    </Typography>
                    <Typography >
                      {formatDuration(analyticsData.sessionDuration)}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          {/* Event Types Breakdown */}
          <Card>
            <CardContent>
              <Typography gutterBottom>
                Event Types
              </Typography>
              <Stack direction="row" flexWrap="wrap" spacing={1}>
                {Object.entries(analyticsData.eventTypes).map(([verbId, count]) => (
                  <Chip
                    key={verbId}
                    icon={getVerbIcon(verbId)}
                    label={`${verbId.split('/').pop()} (${count})`}
                    color={getVerbColor(verbId)}
                    
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* Recent Events */}
          <Card>
            <CardContent>
              <Typography gutterBottom>
                Recent Events
              </Typography>
              <List>
                {statements.slice(-5).reverse().map((stmt, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {getVerbIcon(stmt.verb.id)}
                    </ListItemIcon>
                    <ListItemText
                      primary={stmt.verb.display['en-US'] || stmt.verb.id.split('/').pop()}
                      secondary={`${stmt.object?.id || 'Unknown'} • ${new Date(stmt.timestamp || '').toLocaleTimeString()}`}
                    />
                    {stmt.result?.success !== undefined && (
                      <Chip
                        size="small"
                        label={stmt.result.success ? 'Success' : 'Failed'}
                        color={stmt.result.success ? 'success' : 'error'}
                        
                      />
                    )}
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* Detailed View */}
      {viewMode === 'detailed' && (
        <Card>
          <CardContent>
            <Typography gutterBottom>
              All Events
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>Object</TableCell>
                    <TableCell>Result</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statements.map((stmt, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {new Date(stmt.timestamp || '').toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {getVerbIcon(stmt.verb.id)}
                          <Typography >
                            {stmt.verb.display['en-US'] || stmt.verb.id.split('/').pop()}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography noWrap>
                          {stmt.object?.id || 'Unknown'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {stmt.result?.success !== undefined ? (
                          <Chip
                            size="small"
                            label={stmt.result.success ? 'Success' : 'Failed'}
                            color={stmt.result.success ? 'success' : 'error'}
                            
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {stmt.result?.duration ? (
                          stmt.result.duration.replace('PT', '').replace('S', 's')
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <IconButton 
                          size="small"
                          onClick={() => setSelectedStatement(stmt)}
                        >
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Raw Data View */}
      {viewMode === 'raw' && (
        <Card>
          <CardContent>
            <Typography gutterBottom>
              Raw xAPI Statements ({statements.length} statements)
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              All captured xAPI statements in JSON format
            </Typography>
            <Box
              component="pre"
              sx={{
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100],
                color: theme.palette.mode === 'dark' ? theme.palette.grey[100] : theme.palette.grey[900],
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.75rem',
                maxHeight: 600,
                border: `1px solid ${theme.palette.divider}`,
                fontFamily: 'monospace',
              }}
            >
              {JSON.stringify(statements, null, 2)}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Statement Detail Dialog */}
      <Dialog
        open={!!selectedStatement}
        onClose={() => setSelectedStatement(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Statement Details
        </DialogTitle>
        <DialogContent>
          {selectedStatement && (
            <Box
              component="pre"
              sx={{
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100],
                color: theme.palette.mode === 'dark' ? theme.palette.grey[100] : theme.palette.grey[900],
                p: 2,
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.875rem',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {JSON.stringify(selectedStatement, null, 2)}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedStatement(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
      >
        <DialogTitle>
          Export xAPI Data
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Export all captured xAPI statements for analysis or archival.
          </Typography>
          <Stack spacing={2}>
            <Button
              
              onClick={() => handleExport('json')}
              startIcon={<Download />}
            >
              Export as JSON
            </Button>
            <Button
              
              onClick={() => handleExport('csv')}
              startIcon={<Download />}
            >
              Export as CSV
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};