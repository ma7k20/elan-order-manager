/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#f6f0e6',
    tint: '#d5b77a',

    // Core surfaces
    background: '#111111',
    foreground: '#f6f0e6',

    // Cards / elevated surfaces
    card: '#1c1c1c',
    cardForeground: '#f6f0e6',

    // Primary action color (buttons, links, active states)
    primary: '#d5b77a',
    primaryForeground: '#171717',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#d5b77a',
    secondaryForeground: '#171717',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#292929',
    mutedForeground: '#b7aa97',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#ba7256',
    accentForeground: '#fffaf1',

    // Destructive actions (delete, error states)
    destructive: '#a94c42',
    destructiveForeground: '#fffaf1',

    // Borders and input outlines
    border: '#3a3733',
    input: '#3a3733',
    success: '#2f7659',
    successSoft: '#dcebe0',
    warning: '#a66a28',
    warningSoft: '#f3e7c7',
    dangerSoft: '#f5deda',
    overlay: 'rgba(23, 23, 23, 0.55)',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
