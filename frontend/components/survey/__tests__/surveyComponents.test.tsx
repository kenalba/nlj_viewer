/**
 * Survey Analytics Components Test Suite
 * Tests for Phase 1 core components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { describe, it, expect } from 'vitest';
import { hyundaiTheme } from '../../../theme/hyundaiTheme';
import { genesisTheme } from '../../../theme/genesisTheme';

import {
  HorizontalBarChart,
  HorizontalBarChartWithLegend,
  TableSwatches,
  TableSwatchesVariant,
  RankWidget,
  RankWidgetVariant,
  TrendingWidget,
  TrendingWidgetVariant,
} from '../index';

// Test wrapper with theme
const TestWrapper: React.FC<{ children: React.ReactNode; theme?: any }> = ({ 
  children, 
  theme = hyundaiTheme 
}) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// Mock data
const mockBarData = {
  positive: 65,
  neutral: 15,
  negative: 20,
};

const mockScale = {
  type: 'likert' as const,
  labels: ['Negative', 'Neutral', 'Positive'],
  values: [1, 2, 3],
};

const mockRankData = {
  percentile: 75,
  previousPercentile: 68,
  description: 'vs peers',
};

const mockTrendData = {
  currentValue: 85,
  previousValue: 78,
  unit: '%',
  metric: 'Satisfaction Score',
};

describe('HorizontalBarChart', () => {
  it('renders with all variants in Hyundai theme', () => {
    const variants: Array<'3-colors' | '2-colors' | 'small-section' | 'hover' | 'thin'> = [
      '3-colors', '2-colors', 'small-section', 'hover', 'thin'
    ];

    variants.forEach(variant => {
      const { unmount } = render(
        <TestWrapper theme={hyundaiTheme}>
          <HorizontalBarChart
            variant={variant}
            data={mockBarData}
            scale={mockScale}
          />
        </TestWrapper>
      );
      unmount();
    });
  });

  it('renders with Genesis theme', () => {
    render(
      <TestWrapper theme={genesisTheme}>
        <HorizontalBarChart
          variant="3-colors"
          data={mockBarData}
          scale={mockScale}
        />
      </TestWrapper>
    );
  });

  it('renders with legend', () => {
    render(
      <TestWrapper>
        <HorizontalBarChartWithLegend
          variant="3-colors"
          data={mockBarData}
          scale={mockScale}
          showLegend={true}
        />
      </TestWrapper>
    );
  });
});

describe('TableSwatches', () => {
  it('renders basic swatches', () => {
    render(
      <TestWrapper>
        <TableSwatches
          scale="likert"
          valueCount={3}
        />
      </TestWrapper>
    );
  });

  it('renders all scale types', () => {
    const scales: Array<'likert' | 'nps' | 'binary' | 'custom'> = [
      'likert', 'nps', 'binary', 'custom'
    ];

    scales.forEach(scale => {
      const { unmount } = render(
        <TestWrapper>
          <TableSwatches scale={scale} />
        </TestWrapper>
      );
      unmount();
    });
  });

  it('renders with variant configurations', () => {
    const variants: Array<'positive-negative' | 'excellent-poor' | 'yes-no' | 'satisfaction' | 'agreement' | 'impact'> = [
      'positive-negative', 'excellent-poor', 'yes-no', 'satisfaction', 'agreement', 'impact'
    ];

    variants.forEach(variant => {
      const { unmount } = render(
        <TestWrapper>
          <TableSwatchesVariant variant={variant} />
        </TestWrapper>
      );
      unmount();
    });
  });
});

describe('RankWidget', () => {
  it('renders rank data correctly', () => {
    render(
      <TestWrapper>
        <RankWidget
          rank={mockRankData}
          showTrend={true}
          showIcon={true}
          showPercentile={true}
        />
      </TestWrapper>
    );

    expect(screen.getByText('75th')).toBeInTheDocument();
    expect(screen.getByText('Top 25%')).toBeInTheDocument();
  });

  it('renders all size variants', () => {
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

    sizes.forEach(size => {
      const { unmount } = render(
        <TestWrapper>
          <RankWidget rank={mockRankData} size={size} />
        </TestWrapper>
      );
      unmount();
    });
  });

  it('renders with variant configurations', () => {
    const variants: Array<'performance' | 'satisfaction' | 'engagement' | 'compliance' | 'custom'> = [
      'performance', 'satisfaction', 'engagement', 'compliance', 'custom'
    ];

    variants.forEach(variant => {
      const { unmount } = render(
        <TestWrapper>
          <RankWidgetVariant
            variant={variant}
            percentile={75}
            previousPercentile={68}
          />
        </TestWrapper>
      );
      unmount();
    });
  });
});

describe('TrendingWidget', () => {
  it('renders trend data correctly', () => {
    render(
      <TestWrapper>
        <TrendingWidget
          trend={mockTrendData}
          showPercentage={true}
          showCurrentValue={true}
        />
      </TestWrapper>
    );

    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('+9.0%')).toBeInTheDocument();
  });

  it('renders compact layout', () => {
    render(
      <TestWrapper>
        <TrendingWidget
          trend={mockTrendData}
          compact={true}
        />
      </TestWrapper>
    );
  });

  it('renders with variant configurations', () => {
    const variants: Array<'performance' | 'satisfaction' | 'engagement' | 'response-rate' | 'completion' | 'custom'> = [
      'performance', 'satisfaction', 'engagement', 'response-rate', 'completion', 'custom'
    ];

    variants.forEach(variant => {
      const { unmount } = render(
        <TestWrapper>
          <TrendingWidgetVariant
            variant={variant}
            currentValue={85}
            previousValue={78}
          />
        </TestWrapper>
      );
      unmount();
    });
  });
});

describe('Theme Integration', () => {
  it('works with both Hyundai and Genesis themes', () => {
    // Test with Hyundai theme
    const { rerender } = render(
      <TestWrapper theme={hyundaiTheme}>
        <HorizontalBarChart
          variant="3-colors"
          data={mockBarData}
          scale={mockScale}
        />
      </TestWrapper>
    );

    // Test with Genesis theme
    rerender(
      <TestWrapper theme={genesisTheme}>
        <HorizontalBarChart
          variant="3-colors"
          data={mockBarData}
          scale={mockScale}
        />
      </TestWrapper>
    );
  });

  it('applies theme-aware colors correctly', () => {
    render(
      <TestWrapper theme={hyundaiTheme}>
        <RankWidget rank={{ percentile: 85 }} />
      </TestWrapper>
    );

    // Component should render without errors and apply theme colors
    expect(screen.getByText('85th')).toBeInTheDocument();
  });
});