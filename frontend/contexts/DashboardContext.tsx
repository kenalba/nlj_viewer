/**
 * Dashboard Context
 * Provides role-specific dashboard data and routing logic
 */

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { User } from '../client/auth';

interface DashboardMetrics {
  completedActivities: number;
  totalActivities: number;
  learningHours: number;
  achievements: number;
  upcomingSessions: number;
  pendingReviews: number;
}

interface DashboardQuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error';
}

interface DashboardContext {
  user: User | null;
  dashboardType: 'learner' | 'creator' | 'reviewer' | 'admin' | 'player';
  effectiveRole: string;
  effectiveJobCodes: string[];
  metrics: DashboardMetrics;
  quickActions: DashboardQuickAction[];
  recommendedActivities: any[];
  upcomingEvents: any[];
  recentActivity: any[];
  showRoleSwitcher: boolean;
}

const DashboardContext = createContext<DashboardContext | null>(null);

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const { user } = useAuth();
  
  const dashboardData = useMemo(() => {
    if (!user) {
      return {
        user: null,
        dashboardType: 'player' as const,
        metrics: {
          completedActivities: 0,
          totalActivities: 0,
          learningHours: 0,
          achievements: 0,
          upcomingSessions: 0,
          pendingReviews: 0,
        },
        quickActions: [],
        recommendedActivities: [],
        upcomingEvents: [],
        recentActivity: [],
        showRoleSwitcher: false,
      };
    }

    // Check for role and job code overrides from localStorage (for development/testing)
    let effectiveRole = user.role;
    let effectiveJobCodes = user.job_codes || [];
    
    try {
      if (typeof window !== 'undefined') {
        const overrideRole = localStorage.getItem('viewAsRole');
        const overrideJobCode = localStorage.getItem('viewAsJobCode');
        
        console.log('DashboardContext: Retrieved overrides from localStorage:', { overrideRole, overrideJobCode });
        
        if ((overrideRole || overrideJobCode) && (user.role === 'ADMIN' || process.env.NODE_ENV === 'development')) {
          // Validate and apply role override
          if (overrideRole) {
            const validRoles = ['PLAYER', 'LEARNER', 'CREATOR', 'REVIEWER', 'APPROVER', 'ADMIN'];
            if (validRoles.includes(overrideRole)) {
              effectiveRole = overrideRole as any;
              console.log('DashboardContext: Using override role:', effectiveRole);
            } else {
              console.warn('DashboardContext: Invalid override role, removing:', overrideRole);
              localStorage.removeItem('viewAsRole');
            }
          }
          
          // Validate and apply job code override
          if (overrideJobCode) {
            const validJobCodes = ['DP', 'GM', 'SM', 'SP', 'FM', 'FI', 'BM', 'BD', 'IM'];
            if (validJobCodes.includes(overrideJobCode)) {
              effectiveJobCodes = [overrideJobCode];
              console.log('DashboardContext: Using override job code:', effectiveJobCodes);
            } else {
              console.warn('DashboardContext: Invalid override job code, removing:', overrideJobCode);
              localStorage.removeItem('viewAsJobCode');
            }
          }
        }
      }
    } catch (error) {
      console.error('DashboardContext: Error reading localStorage:', error);
      // Clear any corrupted data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('viewAsRole');
        localStorage.removeItem('viewAsJobCode');
      }
    }
    
    // Determine dashboard type based on effective role
    const role = effectiveRole.toLowerCase();
    let dashboardType: DashboardContext['dashboardType'] = 'player';
    
    // Debug logging
    console.log('DashboardContext: User role:', user.role, 'Effective role:', effectiveRole, 'Lowercase:', role);
    
    if (role === 'learner') {
      dashboardType = 'learner';
    } else if (role === 'creator') {
      dashboardType = 'creator';
    } else if (role === 'reviewer') {
      dashboardType = 'reviewer';
    } else if (role === 'admin' || role === 'approver') {
      dashboardType = 'admin';
    }
    
    console.log('DashboardContext: Dashboard type:', dashboardType);

    // Mock metrics (will be replaced with real API data)
    const mockMetrics: DashboardMetrics = {
      completedActivities: Math.floor(Math.random() * 50) + 10,
      totalActivities: Math.floor(Math.random() * 100) + 50,
      learningHours: Math.floor(Math.random() * 200) + 20,
      achievements: Math.floor(Math.random() * 10) + 2,
      upcomingSessions: Math.floor(Math.random() * 5) + 1,
      pendingReviews: role === 'reviewer' || role === 'admin' ? Math.floor(Math.random() * 15) + 3 : 0,
    };

    // Role-specific quick actions
    const getQuickActions = (): DashboardQuickAction[] => {
      switch (dashboardType) {
        case 'learner':
          return [
            {
              id: 'browse-activities',
              title: 'Browse Activities',
              description: 'Explore learning content',
              icon: '📚',
              path: '/app/activities',
              color: 'primary'
            },
            {
              id: 'training-sessions',
              title: 'Training Sessions',
              description: 'View & register for sessions',
              icon: '🎓',
              path: '/app/training',
              color: 'secondary'
            },
            {
              id: 'my-progress',
              title: 'My Progress',
              description: 'Track learning journey',
              icon: '📈',
              path: '/app/progress',
              color: 'success'
            },
            {
              id: 'certificates',
              title: 'Certificates',
              description: 'View achievements',
              icon: '🏆',
              path: '/app/certifications',
              color: 'warning'
            }
          ];
        
        case 'creator':
          return [
            {
              id: 'create-activity',
              title: 'Create Activity',
              description: 'Build new content',
              icon: '✨',
              path: '/app/flow-editor',
              color: 'primary'
            },
            {
              id: 'content-generation',
              title: 'AI Content Studio',
              description: 'Generate with AI',
              icon: '🤖',
              path: '/app/content-generation',
              color: 'secondary'
            },
            {
              id: 'my-content',
              title: 'My Content',
              description: 'Manage activities',
              icon: '📝',
              path: '/app/activities?created_by=me',
              color: 'info'
            },
            {
              id: 'analytics',
              title: 'Content Analytics',
              description: 'Performance insights',
              icon: '📊',
              path: '/app/analytics',
              color: 'success'
            }
          ];
        
        case 'reviewer':
          return [
            {
              id: 'review-queue',
              title: 'Review Queue',
              description: 'Content awaiting review',
              icon: '🔍',
              path: '/app/activities?status=IN_REVIEW',
              color: 'warning'
            },
            {
              id: 'browse-activities',
              title: 'All Content',
              description: 'Browse all activities',
              icon: '📚',
              path: '/app/activities',
              color: 'primary'
            },
            {
              id: 'approved-content',
              title: 'Recently Approved',
              description: 'View approved items',
              icon: '✅',
              path: '/app/activities?status=PUBLISHED',
              color: 'success'
            }
          ];
        
        case 'admin':
          return [
            {
              id: 'user-management',
              title: 'Manage Users',
              description: 'User administration',
              icon: '👥',
              path: '/app/people',
              color: 'primary'
            },
            {
              id: 'training-management',
              title: 'Training Programs',
              description: 'Create & manage training',
              icon: '🎓',
              path: '/app/training',
              color: 'secondary'
            },
            {
              id: 'system-analytics',
              title: 'System Analytics',
              description: 'Platform insights',
              icon: '📊',
              path: '/app/analytics',
              color: 'info'
            },
            {
              id: 'content-management',
              title: 'Content Library',
              description: 'Manage all content',
              icon: '📚',
              path: '/app/activities',
              color: 'success'
            }
          ];
        
        default:
          // Player role - basic actions
          return [
            {
              id: 'browse-activities',
              title: 'Browse Activities',
              description: 'Explore learning content',
              icon: '📚',
              path: '/app/activities',
              color: 'primary'
            },
            {
              id: 'training-sessions',
              title: 'Training Sessions',
              description: 'Available sessions',
              icon: '🎓',
              path: '/app/training',
              color: 'secondary'
            }
          ];
      }
    };

    // Role and job code-based activity recommendations
    const getRecommendedActivities = () => {
      // Use effective job codes (including overrides from role switcher)
      let jobCodes = effectiveJobCodes;
      
      // For admins, return content review tasks instead of learning activities
      if (dashboardType === 'admin') {
        return [
          { id: 'admin-1', title: 'Review Content Awaiting Approval', type: 'review', completionTime: 0, priority: 'high', dueDate: 'Today', pendingCount: 7 },
          { id: 'admin-2', title: 'Analytics Dashboard Review', type: 'analytics', completionTime: 15, priority: 'medium', dueDate: 'Today' },
          { id: 'admin-3', title: 'User Management Tasks', type: 'admin', completionTime: 10, priority: 'medium', dueDate: 'This Week' },
          { id: 'admin-4', title: 'System Performance Review', type: 'analytics', completionTime: 20, priority: 'low', dueDate: 'This Week' },
          { id: 'admin-5', title: 'Training Program Oversight', type: 'review', completionTime: 25, priority: 'low', dueDate: 'Next Week' },
          { id: 'admin-6', title: 'Content Quality Assurance', type: 'review', completionTime: 30, priority: 'low', dueDate: 'Next Week' }
        ];
      }
      
      // Comprehensive activity library based on HPI learning structure
      const mockActivities = [
        // STAR Qualified Content (SM, SP)
        { id: '1', title: 'Frictionless Sales Abilities - Building Influence', type: 'training', jobCodes: ['SP'], completionTime: 15, priority: 'high', dueDate: 'Today' },
        { id: '2', title: 'Social Styles Assessment', type: 'assessment', jobCodes: ['SP', 'SM'], completionTime: 20, priority: 'high', dueDate: 'Today' },
        { id: '3', title: 'Results Focused Questions™ Practice', type: 'game', jobCodes: ['SP'], completionTime: 10, priority: 'high', dueDate: 'Tomorrow' },
        
        // Manager Content (SM)
        { id: '4', title: 'FastLane Leadership Abilities - Vision Values', type: 'training', jobCodes: ['SM'], completionTime: 15, priority: 'medium', dueDate: 'This Week' },
        { id: '5', title: 'Employee Engagement Workshop', type: 'training', jobCodes: ['SM'], completionTime: 30, priority: 'medium', dueDate: 'This Week' },
        { id: '6', title: 'Coaching Skills Development', type: 'training', jobCodes: ['SM'], completionTime: 25, priority: 'low', dueDate: 'Next Week' },
        
        // Ambassador Qualified (DP, GM, FM, FI, BM, BD, IM)
        { id: '7', title: 'Executive Leadership Series - CX Focus', type: 'training', jobCodes: ['DP', 'GM'], completionTime: 15, priority: 'high', dueDate: 'Today' },
        { id: '8', title: 'Modern Retail Strategies', type: 'training', jobCodes: ['DP', 'GM'], completionTime: 20, priority: 'medium', dueDate: 'Tomorrow' },
        { id: '9', title: 'Finance Best Practices Update', type: 'training', jobCodes: ['FM', 'FI'], completionTime: 25, priority: 'high', dueDate: 'Today' },
        
        // BDC Specific Content
        { id: '10', title: 'Lead Response Excellence', type: 'training', jobCodes: ['BM', 'BD'], completionTime: 20, priority: 'high', dueDate: 'Today' },
        { id: '11', title: 'CRM Management Best Practices', type: 'training', jobCodes: ['BM', 'BD', 'IM'], completionTime: 30, priority: 'medium', dueDate: 'This Week' },
        
        // Smart Practice Content (Any)
        { id: '12', title: 'Product Knowledge Flashcards', type: 'game', jobCodes: ['SP', 'SM', 'BD'], completionTime: 5, priority: 'low', dueDate: 'Anytime' },
        { id: '13', title: 'Customer Objection Handling', type: 'game', jobCodes: ['SP', 'FM', 'FI'], completionTime: 8, priority: 'medium', dueDate: 'This Week' },
        
        // New Hire Journey
        { id: '14', title: 'New Hire Journey - Week 1: Brand Introduction', type: 'training', jobCodes: ['SP'], completionTime: 45, priority: 'high', dueDate: 'Today', isNewHire: true },
        { id: '15', title: 'New Hire Journey - Week 2: Sales Process', type: 'training', jobCodes: ['SP'], completionTime: 60, priority: 'high', dueDate: 'Next Week', isNewHire: true },
        
        // Recommended Content
        { id: '16', title: 'Advanced Negotiation Techniques', type: 'training', jobCodes: ['SP', 'SM'], completionTime: 35, priority: 'low', dueDate: 'Optional', isRecommended: true },
        { id: '17', title: 'Customer Retention Strategies', type: 'survey', jobCodes: ['SP', 'SM', 'GM'], completionTime: 15, priority: 'low', dueDate: 'Optional', isRecommended: true },
      ];

      // Filter activities based on user's job codes and prioritize
      const filteredActivities = mockActivities.filter(activity => 
        activity.jobCodes.some(code => jobCodes.includes(code))
      );
      
      // Sort by priority and due date
      return filteredActivities.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const dateOrder = { 'Today': 5, 'Tomorrow': 4, 'This Week': 3, 'Next Week': 2, 'Anytime': 1, 'Optional': 0 };
        
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        return dateOrder[b.dueDate] - dateOrder[a.dueDate];
      });
    };

    // Role-specific upcoming events
    const getUpcomingEvents = () => {
      // For admins, show administrative events
      if (dashboardType === 'admin') {
        return [
          { id: 'admin-event-1', title: 'Content Review Meeting', date: new Date(Date.now() + 86400000 * 1), type: 'meeting' },
          { id: 'admin-event-2', title: 'Platform Analytics Review', date: new Date(Date.now() + 86400000 * 3), type: 'review' },
          { id: 'admin-event-3', title: 'Quarterly Training Strategy', date: new Date(Date.now() + 86400000 * 7), type: 'planning' }
        ];
      }
      
      const baseEvents = [
        { id: '1', title: 'Monthly STAR Qualification Deadline', date: new Date(Date.now() + 86400000 * 3), type: 'deadline', jobCodes: ['SM', 'SP'] },
        { id: '2', title: 'New Hire Orientation', date: new Date(Date.now() + 86400000 * 5), type: 'workshop', jobCodes: ['ALL'] },
      ];
      
      const roleSpecificEvents = {
        'DP': [
          { id: '3', title: 'Executive Leadership Series Launch', date: new Date(Date.now() + 86400000 * 2), type: 'webinar', jobCodes: ['DP'] },
          { id: '4', title: 'Dealer Principal Monthly Meeting', date: new Date(Date.now() + 86400000 * 7), type: 'meeting', jobCodes: ['DP'] },
        ],
        'GM': [
          { id: '5', title: 'Operations Review Meeting', date: new Date(Date.now() + 86400000 * 4), type: 'meeting', jobCodes: ['GM'] },
          { id: '6', title: 'Q5 Learning Curriculum Briefing', date: new Date(Date.now() + 86400000 * 6), type: 'webinar', jobCodes: ['GM', 'SM'] },
        ],
        'SM': [
          { id: '7', title: 'FastLane Leadership Workshop', date: new Date(Date.now() + 86400000 * 3), type: 'workshop', jobCodes: ['SM'] },
          { id: '8', title: 'Sales Team Performance Review', date: new Date(Date.now() + 86400000 * 8), type: 'meeting', jobCodes: ['SM'] },
        ],
        'SP': [
          { id: '9', title: 'Frictionless Sales Training Session', date: new Date(Date.now() + 86400000 * 2), type: 'training', jobCodes: ['SP'] },
          { id: '10', title: 'Product Knowledge Update', date: new Date(Date.now() + 86400000 * 5), type: 'webinar', jobCodes: ['SP'] },
        ],
      };
      
      let relevantEvents = [...baseEvents];
      
      effectiveJobCodes.forEach(jobCode => {
        if (roleSpecificEvents[jobCode]) {
          relevantEvents = [...relevantEvents, ...roleSpecificEvents[jobCode]];
        }
      });
      
      return relevantEvents.slice(0, 3);
    };

    // Role-specific recent activity
    const getRecentActivity = () => {
      const activities = {
        'SP': [
          { id: '1', action: 'Completed', item: 'Social Styles Assessment', timestamp: new Date(Date.now() - 3600000) },
          { id: '2', action: 'Started', item: 'Building Influence Training', timestamp: new Date(Date.now() - 7200000) },
          { id: '3', action: 'Achieved', item: 'STAR Qualified Status', timestamp: new Date(Date.now() - 86400000) }
        ],
        'SM': [
          { id: '1', action: 'Reviewed', item: 'Team Performance Metrics', timestamp: new Date(Date.now() - 3600000) },
          { id: '2', action: 'Completed', item: 'Leadership Coaching Module', timestamp: new Date(Date.now() - 7200000) },
          { id: '3', action: 'Assigned', item: 'New Employee Training Plan', timestamp: new Date(Date.now() - 86400000) }
        ],
        'GM': [
          { id: '1', action: 'Approved', item: '15 Pending Learning Activities', timestamp: new Date(Date.now() - 3600000) },
          { id: '2', action: 'Completed', item: 'Executive Leadership Series', timestamp: new Date(Date.now() - 7200000) },
          { id: '3', action: 'Reviewed', item: 'BA Certification Progress', timestamp: new Date(Date.now() - 86400000) }
        ],
        'DP': [
          { id: '1', action: 'Reviewed', item: 'Dealership Learning Analytics', timestamp: new Date(Date.now() - 3600000) },
          { id: '2', action: 'Approved', item: 'Q1 Training Budget', timestamp: new Date(Date.now() - 7200000) },
          { id: '3', action: 'Achieved', item: 'Brand Ambassador Certification', timestamp: new Date(Date.now() - 86400000) }
        ]
      };
      
      if (effectiveJobCodes.length > 0) {
        return activities[effectiveJobCodes[0]] || activities['SP'];
      }
      return activities['SP'];
    };

    return {
      user,
      dashboardType,
      effectiveRole,
      effectiveJobCodes,
      metrics: mockMetrics,
      quickActions: getQuickActions(),
      recommendedActivities: getRecommendedActivities(),
      upcomingEvents: getUpcomingEvents(),
      recentActivity: getRecentActivity(),
      showRoleSwitcher: user.role === 'ADMIN' || process.env.NODE_ENV === 'development',
    };
  }, [user]);

  return (
    <DashboardContext.Provider value={dashboardData}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};