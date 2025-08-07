/**
 * Placeholder Card Component
 * Reusable placeholder for upcoming features
 */

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';

interface PlaceholderCardProps {
  title: string;
  description: string;
  features: string[];
}

export const PlaceholderCard: React.FC<PlaceholderCardProps> = ({ title, description, features }) => (
  <Card sx={{ border: '2px dashed', borderColor: 'grey.300', bgcolor: 'grey.50' }}>
    <CardContent>
      <Typography variant="h6" gutterBottom color="text.secondary">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {description}
      </Typography>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Planned Features:
      </Typography>
      <List dense>
        {features.map((feature, index) => (
          <ListItem key={index} sx={{ py: 0 }}>
            <ListItemIcon sx={{ minWidth: 20 }}>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'grey.400' }} />
            </ListItemIcon>
            <ListItemText 
              primary={feature} 
              primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
            />
          </ListItem>
        ))}
      </List>
    </CardContent>
  </Card>
);