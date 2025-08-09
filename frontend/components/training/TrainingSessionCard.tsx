/**
 * Training Session Card
 * Reusable card component for displaying training session information
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  Avatar,
} from '@mui/material';
import {
  Event as EventIcon,
  Group as GroupIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { type TrainingSession } from '../../client/training';

interface TrainingSessionCardProps {
  session: TrainingSession;
  onRegister?: (session: TrainingSession) => void;
  onViewDetails?: (session: TrainingSession) => void;
  registrationStatus?: 'registered' | 'available' | 'full' | 'waitlist';
  compact?: boolean;
  showActions?: boolean;
}

const TrainingSessionCard: React.FC<TrainingSessionCardProps> = ({
  session,
  onRegister,
  onViewDetails,
  registrationStatus = 'available',
  compact = false,
  showActions = true,
}) => {
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
  };

  const getRegistrationStatusColor = (status: string) => {
    switch (status) {
      case 'registered': return 'success';
      case 'available': return 'primary';
      case 'waitlist': return 'warning';
      case 'full': return 'error';
      default: return 'default';
    }
  };

  const getAvailabilityText = () => {
    if (session.upcoming_instances === 0) return 'No sessions scheduled';
    if (session.total_bookings >= session.capacity) return 'Fully booked';
    return `${session.capacity - session.total_bookings} spots available`;
  };

  return (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) => theme.shadows[8],
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
            <EventIcon />
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography 
              variant={compact ? 'subtitle1' : 'h6'} 
              component="h3" 
              sx={{ 
                fontWeight: 600,
                lineHeight: 1.2,
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {session.title}
            </Typography>
            <Chip
              label={registrationStatus}
              color={getRegistrationStatusColor(registrationStatus) as any}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Description */}
        {!compact && session.description && (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {session.description}
          </Typography>
        )}

        {/* Session Details */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip
            icon={<ScheduleIcon />}
            label={formatDuration(session.duration_minutes)}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<GroupIcon />}
            label={`${session.capacity} max`}
            size="small"
            variant="outlined"
          />
          {session.location && (
            <Chip
              icon={<LocationIcon />}
              label={session.location}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Availability Status */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Upcoming sessions:</strong> {session.upcoming_instances}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Availability:</strong> {getAvailabilityText()}
          </Typography>
        </Box>

        {/* Learning Objectives Preview */}
        {!compact && session.learning_objectives && session.learning_objectives.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Learning Objectives:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {session.learning_objectives.slice(0, 2).map((objective, index) => (
                <Typography 
                  key={index} 
                  component="li" 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  {objective}
                </Typography>
              ))}
              {session.learning_objectives.length > 2 && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  +{session.learning_objectives.length - 2} more...
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </CardContent>

      {/* Actions */}
      {showActions && (
        <CardActions sx={{ pt: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
            {onViewDetails && (
              <Button 
                size="small" 
                variant="outlined"
                onClick={() => onViewDetails(session)}
              >
                Details
              </Button>
            )}
            {onRegister && registrationStatus !== 'registered' && (
              <Button
                size="small"
                variant="contained"
                onClick={() => onRegister(session)}
                disabled={registrationStatus === 'full' && !session.allow_waitlist}
                sx={{ ml: 'auto' }}
              >
                {registrationStatus === 'full' && session.allow_waitlist 
                  ? 'Join Waitlist' 
                  : registrationStatus === 'full' 
                    ? 'Full' 
                    : 'Register'
                }
              </Button>
            )}
            {registrationStatus === 'registered' && (
              <Chip
                label="Registered"
                color="success"
                size="small"
                sx={{ ml: 'auto' }}
              />
            )}
          </Box>
        </CardActions>
      )}
    </Card>
  );
};

export default TrainingSessionCard;