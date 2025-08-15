/**
 * Compliance Dashboard Component
 * Comprehensive compliance tracking and risk assessment
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  useTheme
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  NotificationImportant as AlertIcon,
  Timeline as TimelineIcon,
  Insights as InsightsIcon,
  AutoFixHigh as InterventionIcon,
  PriorityHigh as HighRiskIcon
} from '@mui/icons-material';
import { apiClient } from '../../client/client';

interface ComplianceRequirement {
  requirement_id: string;
  title: string;
  status: 'COMPLIANT' | 'MISSING' | 'EXPIRED' | 'AT_RISK';
  completion_date?: string;
  expiration_date?: string;
  risk_score: number;
}

interface ComplianceStatus {
  user_id: string;
  user_name?: string;
  user_email?: string;
  requirements: ComplianceRequirement[];
  overall_compliance_rate: number;
  next_expirations: Array<{
    requirement: string;
    days_until_expiration: number;
  }>;
}

interface ComplianceRisk {
  user_id: string;
  risk_score: number;
  risk_factors: string[];
  recommended_actions: string[];
  confidence_level: number;
}

interface ComplianceDashboardProps {
  userId?: string;
  showAllUsers?: boolean;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  userId,
  showAllUsers = false
}) => {
  const theme = useTheme();
  const [complianceData, setComplianceData] = useState<ComplianceStatus[]>([]);
  const [riskData, setRiskData] = useState<ComplianceRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<ComplianceStatus | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const fetchComplianceData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // For now, we'll generate mock data since the compliance endpoints aren't fully implemented
      // In a real implementation, this would fetch from:
      // - /api/analytics/compliance-status/{userId} for individual users
      // - /api/analytics/compliance-overview for all users
      
      const mockComplianceData = generateMockComplianceData(userId, showAllUsers);
      setComplianceData(mockComplianceData);
      
      // Fetch risk assessments (skip API call that doesn't exist)
      if (userId) {
        // Generate mock risk data instead of calling non-existent API
        setRiskData([{
          user_id: userId,
          risk_score: Math.random() * 0.3 + 0.1, // 0.1-0.4 risk score
          risk_factors: ['Training overdue', 'Low engagement'],
          recommended_actions: ['Schedule refresher training', 'Increase monitoring'],
          confidence_level: 0.85
        }]);
      }
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplianceData();
  }, [userId, showAllUsers]);

  const generateMockComplianceData = (userId?: string, showAll?: boolean): ComplianceStatus[] => {
    const users = showAll ? [
      { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
      { id: '2', name: 'Bob Smith', email: 'bob@example.com' },
      { id: '3', name: 'Carol Davis', email: 'carol@example.com' },
      { id: '4', name: 'David Wilson', email: 'david@example.com' }
    ] : [{ id: userId || '1', name: 'Current User', email: 'user@example.com' }];

    return users.map(user => ({
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      overall_compliance_rate: Math.random() * 0.4 + 0.6, // 60-100%
      requirements: [
        {
          requirement_id: 'safety-training',
          title: 'Annual Safety Training',
          status: Math.random() > 0.8 ? 'EXPIRED' : Math.random() > 0.6 ? 'AT_RISK' : 'COMPLIANT',
          completion_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          expiration_date: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
          risk_score: Math.random() * 0.5
        },
        {
          requirement_id: 'compliance-cert',
          title: 'Compliance Certification',
          status: Math.random() > 0.7 ? 'MISSING' : 'COMPLIANT',
          completion_date: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 200 * 24 * 60 * 60 * 1000).toISOString() : undefined,
          expiration_date: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          risk_score: Math.random() * 0.8
        },
        {
          requirement_id: 'product-knowledge',
          title: 'Product Knowledge Assessment',
          status: Math.random() > 0.9 ? 'AT_RISK' : 'COMPLIANT',
          completion_date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
          expiration_date: new Date(Date.now() + Math.random() * 270 * 24 * 60 * 60 * 1000).toISOString(),
          risk_score: Math.random() * 0.3
        }
      ],
      next_expirations: [
        { requirement: 'Annual Safety Training', days_until_expiration: Math.floor(Math.random() * 90) },
        { requirement: 'Compliance Certification', days_until_expiration: Math.floor(Math.random() * 180) + 90 }
      ]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT': return theme.palette.success.main;
      case 'AT_RISK': return theme.palette.warning.main;
      case 'EXPIRED': return theme.palette.error.main;
      case 'MISSING': return theme.palette.text.secondary;
      default: return theme.palette.text.secondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLIANT': return <CheckCircleIcon />;
      case 'AT_RISK': return <WarningIcon />;
      case 'EXPIRED': return <CancelIcon />;
      case 'MISSING': return <ScheduleIcon />;
      default: return <AssignmentIcon />;
    }
  };

  const getRiskLevel = (score: number) => {
    if (score > 0.7) return 'High';
    if (score > 0.4) return 'Medium';
    return 'Low';
  };

  const getRiskColor = (score: number) => {
    if (score > 0.7) return theme.palette.error.main;
    if (score > 0.4) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const calculateDaysFromNow = (dateString: string) => {
    const days = Math.ceil((new Date(dateString).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const handleUserDetails = (user: ComplianceStatus) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={fetchComplianceData}>
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  const overallStats = complianceData.length > 0 ? {
    avgComplianceRate: complianceData.reduce((sum, user) => sum + user.overall_compliance_rate, 0) / complianceData.length,
    totalUsers: complianceData.length,
    atRiskUsers: complianceData.filter(user => 
      user.requirements.some(req => req.status === 'AT_RISK' || req.status === 'EXPIRED')
    ).length,
    upcomingExpirations: complianceData.flatMap(user => 
      user.next_expirations.filter(exp => exp.days_until_expiration <= 30)
    ).length
  } : null;

  return (
    <Box>
      {/* Header and Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon color="primary" />
            Compliance Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Real-time compliance tracking and risk assessment
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {showAllUsers && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>View</InputLabel>
              <Select
                value={viewMode}
                label="View"
                onChange={(e) => setViewMode(e.target.value as 'overview' | 'detailed')}
              >
                <MenuItem value="overview">Overview</MenuItem>
                <MenuItem value="detailed">Detailed</MenuItem>
              </Select>
            </FormControl>
          )}
          
          <Tooltip title="Refresh Data">
            <span>
              <IconButton onClick={fetchComplianceData} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* User Search */}
      {showAllUsers && (
        <Box sx={{ mb: 3 }}>
          <TextField
            size="small"
            placeholder="Search for specific user compliance..."
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 400 }}
          />
        </Box>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Dashboard Content */}
      {!loading && complianceData.length > 0 && (
        <>
          {/* Overview Stats */}
          {overallStats && (
            <Box sx={{ 
              display: 'flex', 
              gap: 3, 
              mb: 3,
              flexDirection: { xs: 'column', md: 'row' }
            }}>
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {(overallStats.avgComplianceRate * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Overall Compliance Rate
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {overallStats.totalUsers}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Users Tracked
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {overallStats.atRiskUsers}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Users at Risk
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {overallStats.upcomingExpirations}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Expiring Soon (30 days)
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}

          {/* User Compliance Cards */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3 
          }}>
            {complianceData
              .filter(user => 
                !userSearchTerm || 
                user.user_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                user.user_email?.toLowerCase().includes(userSearchTerm.toLowerCase())
              )
              .map((user) => (
              <Box key={user.user_id} sx={{ width: '100%' }}>
                <Card>
                  <CardContent>
                    {/* User Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                          <PersonIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6">
                            {user.user_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {user.user_email}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="h6" color="primary">
                          {(user.overall_compliance_rate * 100).toFixed(1)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Compliance Rate
                        </Typography>
                      </Box>
                    </Box>

                    {/* Compliance Progress */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        Overall Compliance Progress
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={user.overall_compliance_rate * 100}
                        color={user.overall_compliance_rate > 0.8 ? 'success' : 'warning'}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>

                    {/* Requirements Status */}
                    <Typography variant="body2" gutterBottom sx={{ fontWeight: 'medium' }}>
                      Requirements Status
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      {user.requirements.slice(0, 3).map((req) => (
                        <Box key={req.requirement_id} sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          py: 0.5 
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ color: getStatusColor(req.status) }}>
                              {getStatusIcon(req.status)}
                            </Box>
                            <Typography variant="body2">
                              {req.title}
                            </Typography>
                          </Box>
                          <Chip 
                            label={req.status.replace('_', ' ')}
                            size="small"
                            sx={{ 
                              bgcolor: getStatusColor(req.status),
                              color: 'white',
                              fontWeight: 'bold'
                            }}
                          />
                        </Box>
                      ))}
                    </Box>

                    {/* Upcoming Expirations */}
                    {user.next_expirations.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom sx={{ fontWeight: 'medium' }}>
                          Upcoming Expirations
                        </Typography>
                        {user.next_expirations.slice(0, 2).map((exp, index) => (
                          <Alert 
                            key={index}
                            severity={exp.days_until_expiration <= 30 ? "warning" : "info"}
                            sx={{ mb: 1 }}
                          >
                            <Typography variant="body2">
                              <strong>{exp.requirement}</strong> expires in {exp.days_until_expiration} days
                            </Typography>
                          </Alert>
                        ))}
                      </Box>
                    )}

                    {/* Risk Assessment (if available) */}
                    {riskData.find(risk => risk.user_id === user.user_id) && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom sx={{ fontWeight: 'medium' }}>
                          Risk Assessment
                        </Typography>
                        {(() => {
                          const userRisk = riskData.find(risk => risk.user_id === user.user_id)!;
                          return (
                            <Alert severity={userRisk.risk_score > 0.7 ? "error" : userRisk.risk_score > 0.4 ? "warning" : "success"}>
                              <Typography variant="body2">
                                <strong>{getRiskLevel(userRisk.risk_score)} Risk</strong> 
                                {' '}({(userRisk.risk_score * 100).toFixed(0)}% risk score)
                              </Typography>
                              {userRisk.recommended_actions.length > 0 && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  <strong>Recommended:</strong> {userRisk.recommended_actions[0]}
                                </Typography>
                              )}
                            </Alert>
                          );
                        })()}
                      </Box>
                    )}

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        onClick={() => handleUserDetails(user)}
                        startIcon={<InsightsIcon />}
                      >
                        View Details
                      </Button>
                      {user.requirements.some(req => req.status === 'AT_RISK' || req.status === 'EXPIRED') && (
                        <Button
                          size="small"
                          color="error"
                          startIcon={<InterventionIcon />}
                        >
                          Intervene
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </>
      )}

      {/* User Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Compliance Details - {selectedUser?.user_name}
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box>
              {/* Detailed Requirements */}
              <Typography variant="h6" gutterBottom>
                All Requirements
              </Typography>
              <List>
                {selectedUser.requirements.map((req) => (
                  <ListItem key={req.requirement_id}>
                    <ListItemIcon sx={{ color: getStatusColor(req.status) }}>
                      {getStatusIcon(req.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={req.title}
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            Status: <strong>{req.status.replace('_', ' ')}</strong>
                          </Typography>
                          {req.completion_date && (
                            <Typography variant="body2">
                              Completed: {formatDate(req.completion_date)}
                            </Typography>
                          )}
                          {req.expiration_date && (
                            <Typography variant="body2">
                              Expires: {formatDate(req.expiration_date)} 
                              ({calculateDaysFromNow(req.expiration_date)} days)
                            </Typography>
                          )}
                          <Typography variant="body2">
                            Risk Score: {(req.risk_score * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComplianceDashboard;