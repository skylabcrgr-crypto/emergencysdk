/**
 * authStyles.ts
 * Shared inline style objects for the auth & admin UI, matching the dark
 * operations-console theme used across the dashboard.
 */

import type { CSSProperties } from 'react';

export const colors = {
  bg: '#0b0b0c',
  panel: '#121214',
  panelAlt: '#161619',
  border: '#26262b',
  borderStrong: '#34343b',
  text: '#e8e8ea',
  textDim: '#9a9aa2',
  textFaint: '#6b6b73',
  accent: '#2f6fed',
  accentHover: '#3a78f0',
  danger: '#e5484d',
  dangerBg: '#2a0e0f',
  success: '#30a46c',
  successBg: '#0e2018',
  warning: '#f5a623',
  warningBg: '#241a05',
};

export const screenWrap: CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.bg,
  backgroundImage:
    'radial-gradient(900px 500px at 50% -10%, rgba(47,111,237,0.10), transparent)',
  padding: 24,
  boxSizing: 'border-box',
};

export const card: CSSProperties = {
  width: '100%',
  maxWidth: 420,
  backgroundColor: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  padding: 32,
  boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
  boxSizing: 'border-box',
};

export const brandRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 6,
};

export const title: CSSProperties = {
  color: colors.text,
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
  letterSpacing: 0.2,
};

export const subtitle: CSSProperties = {
  color: colors.textDim,
  fontSize: 13,
  margin: '6px 0 22px',
  lineHeight: 1.5,
};

export const label: CSSProperties = {
  display: 'block',
  color: colors.textDim,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 6,
};

export const input: CSSProperties = {
  width: '100%',
  backgroundColor: colors.panelAlt,
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: 8,
  color: colors.text,
  fontSize: 14,
  padding: '11px 12px',
  outline: 'none',
  boxSizing: 'border-box',
};

export const fieldGroup: CSSProperties = { marginBottom: 16 };

export const primaryButton: CSSProperties = {
  width: '100%',
  backgroundColor: colors.accent,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

export const secondaryButton: CSSProperties = {
  width: '100%',
  backgroundColor: 'transparent',
  color: colors.textDim,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

export const linkButton: CSSProperties = {
  background: 'none',
  border: 'none',
  color: colors.accent,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
};

export const errorBox: CSSProperties = {
  backgroundColor: colors.dangerBg,
  border: `1px solid ${colors.danger}`,
  color: '#ffb4b6',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  marginBottom: 16,
  lineHeight: 1.45,
};

export const successBox: CSSProperties = {
  backgroundColor: colors.successBg,
  border: `1px solid ${colors.success}`,
  color: '#86e0b3',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  marginBottom: 16,
  lineHeight: 1.45,
};

export const devBox: CSSProperties = {
  backgroundColor: colors.warningBg,
  border: `1px dashed ${colors.warning}`,
  color: '#f3cd7e',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 12,
  marginTop: 16,
  wordBreak: 'break-all',
};
