/**
 * Survey Analytics Component Library
 * Phase 1: Core theme-aware components for survey data visualization
 */

// Theme utilities
export { 
  getResponseColors, 
  getRankingColor, 
  getTrendingColor, 
  getDemographicColors,
  getAnonymizedColor,
  useSurveyColors 
} from '../../theme/surveyTheme';

// Core components
export { 
  HorizontalBarChart, 
  HorizontalBarChartWithLegend,
  type HorizontalBarChartProps,
  type HorizontalBarChartWithLegendProps,
  type ResponseDistribution,
  type QuestionScale
} from './HorizontalBarChart';

export { 
  TableSwatches, 
  TableSwatchesVariant,
  type TableSwatchesProps,
  type TableSwatchesVariantProps
} from './TableSwatches';

export { 
  RankWidget, 
  RankWidgetVariant,
  type RankWidgetProps,
  type RankWidgetVariantProps,
  type RankData
} from './RankWidget';

export { 
  TrendingWidget, 
  TrendingWidgetVariant,
  type TrendingWidgetProps,
  type TrendingWidgetVariantProps,
  type TrendData
} from './TrendingWidget';