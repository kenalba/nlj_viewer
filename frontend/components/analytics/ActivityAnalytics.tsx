/**
 * Activity Analytics Component
 * Content performance analytics and insights
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { PlaceholderCard } from './PlaceholderCard';

export const ActivityAnalytics: React.FC = () => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📚 Content Performance Analytics
      </Typography>

      {/* Activity Performance Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Activity Performance Overview
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Activity</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Attempts</TableCell>
                  <TableCell align="right">Completion %</TableCell>
                  <TableCell align="right">Avg Score</TableCell>
                  <TableCell align="right">Difficulty</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  { name: "Sales Process Training", type: "Assessment", attempts: 245, completion: 87, score: 0.82, difficulty: "Medium" },
                  { name: "Product Knowledge Quiz", type: "Quiz", attempts: 189, completion: 93, score: 0.91, difficulty: "Easy" },
                  { name: "Customer Service Scenarios", type: "Scenario", attempts: 156, completion: 74, score: 0.68, difficulty: "Hard" },
                  { name: "Compliance Training", type: "Training", attempts: 298, completion: 96, score: 0.88, difficulty: "Easy" },
                  { name: "Leadership Skills", type: "Assessment", attempts: 87, completion: 65, score: 0.72, difficulty: "Hard" }
                ].map((activity, index) => (
                  <TableRow key={index}>
                    <TableCell>{activity.name}</TableCell>
                    <TableCell>
                      <Chip label={activity.type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">{activity.attempts}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        {activity.completion}%
                        <LinearProgress 
                          variant="determinate" 
                          value={activity.completion} 
                          sx={{ width: 50, height: 4 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {(activity.score * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={activity.difficulty} 
                        size="small"
                        color={
                          activity.difficulty === 'Easy' ? 'success' : 
                          activity.difficulty === 'Medium' ? 'warning' : 'error'
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small">
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' }, mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Completion Rates by Activity Type
              </Typography>
              <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">
                  Interactive pie chart showing completion rates by content type (Assessment, Quiz, Scenario, Training)
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💡 Difficulty vs Engagement
              </Typography>
              <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">
                  Scatter plot showing relationship between content difficulty and learner engagement
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Placeholder for Advanced Activity Analytics */}
      <PlaceholderCard 
        title="🎯 Advanced Content Intelligence"
        description="AI-powered content performance insights and optimization recommendations."
        features={[
          "Content difficulty auto-calibration",
          "Learner engagement prediction models",
          "Content gap analysis and recommendations", 
          "A/B testing for content variations",
          "Personalized content sequencing (ML-powered)"
        ]}
      />
    </Box>
  );
};