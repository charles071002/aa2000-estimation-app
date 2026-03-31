import React from 'react';

export const COLORS = {
  primary: '#2563eb',
  secondary: '#2563eb',
  accent: '#F59E0B',
  background: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280'
};

import logoUrl from './assets/images/logo.svg';

/**
 * AA2000_LOGO: The official branding component for the application.
 * Uses the standard AA2000 logo SVG for consistent branding across the site.
 */
export const AA2000_LOGO = (
  <div className="flex flex-col items-center justify-center space-y-1 p-4">
    <img src={logoUrl} alt="AA2000" className="h-24 w-auto object-contain" aria-hidden="false" />
    <p className="text-[10px] font-normal tracking-tighter text-black uppercase text-center" style={{ fontFamily: 'Arial, sans-serif' }}>
      Security and Technology Solutions Inc.
    </p>
  </div>
);

/**
 * AA2000_ICON: Compact brand icon for tight header/toolbar layouts.
 */
export const AA2000_ICON = (
  <img src={logoUrl} alt="AA2000" className="h-8 w-8 object-contain" aria-hidden="false" />
);

export const CAMERA_PURPOSES = ['Face Recognition', 'General Monitoring', 'LPR', 'Crowd Monitoring'];
export const CAMERA_TYPES = ['Dome', 'Bullet', 'PTZ', 'Fisheye'];
export const RESOLUTIONS = ['2MP', '4MP', '6MP', '8MP'];
export const LIGHTING_CONDITIONS = ['Good Lighting', 'Low Light', 'No Light'];
export const BUILDING_TYPES = ['Airport', 'Terminal', 'Office', 'Warehouse', 'Residential', 'Other'];
