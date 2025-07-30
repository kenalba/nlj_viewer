/**
 * Custom Variables icon for the Flow Editor header
 * Represents mathematical functions/variables (fx)
 */

import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const VariablesIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M8.5 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm6.5 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-9.5 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" />
      <path
        fill="currentColor"
        d="M9 2v2H7v2h2v2h2V6h2V4h-2V2H9zm0 14v2H7v2h2v2h2v-2h2v-2H9v-2H7v2h2z"
      />
      <path
        fill="currentColor"
        d="M2 8h2v2h2v2H4v2H2v-2H0V8h2zm18 0h2v2h2v2h-2v2h-2v-2h-2V8h2z"
      />
    </SvgIcon>
  );
};

// Alternative simpler fx icon
export const FxIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="10"
        fontFamily="monospace"
        fontWeight="bold"
        fill="currentColor"
      >
        fx
      </text>
    </SvgIcon>
  );
};

// Function-style variables icon
export const FunctionIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M15.6,5.5L14.2,4.1L12,6.3L9.8,4.1L8.4,5.5L10.6,7.7L8.4,9.9L9.8,11.3L12,9.1L14.2,11.3L15.6,9.9L13.4,7.7L15.6,5.5M21,1H3C1.9,1 1,1.9 1,3V21C1,22.1 1.9,23 3,23H21C22.1,23 23,22.1 23,21V3C23,1.9 22.1,1 21,1M21,21H3V3H21V21M2,15H4V17H2V15M6,15H8V17H6V15M20,15H22V17H20V15M16,15H18V17H16V15"
      />
    </SvgIcon>
  );
};