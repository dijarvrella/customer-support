/**
 * Organization Branding Configuration
 *
 * This module provides org-level customization for the ITSM portal.
 * To white-label for a different company, update the BRANDING constant
 * or load it from an environment variable / database.
 */

export interface OrgBranding {
  /** Organization name displayed in the portal */
  orgName: string;
  /** Short name for compact displays */
  orgShortName: string;
  /** Portal title shown in browser tab */
  portalTitle: string;
  /** Subtitle on login page */
  portalSubtitle: string;
  /** Path to logo image (in /public or external URL) */
  logoUrl: string;
  /** Path to logo icon (small, for sidebar/favicon) */
  logoIconUrl: string;
  /** Path to favicon */
  faviconUrl: string;
  /** Primary brand color (HSL values for CSS variable) */
  primaryColor: string;
  /** Primary foreground (text on primary bg) */
  primaryForeground: string;
  /** Footer text */
  footerText: string;
  /** Support email shown in portal */
  supportEmail: string;
  /** Slack channel for IT requests */
  slackChannel: string;
  /** Custom CSS class applied to root element */
  cssClass: string;
}

/**
 * Default branding for Zimark.
 * To customize for another org, either:
 * 1. Change these values directly, or
 * 2. Set ORG_BRANDING env var with JSON, or
 * 3. Load from a database org_settings table
 */
const DEFAULT_BRANDING: OrgBranding = {
  orgName: "Zimark",
  orgShortName: "ZM",
  portalTitle: "Zimark ITSM - IT Support Portal",
  portalSubtitle: "Internal IT Service Management",
  logoUrl: "/logo.svg",
  logoIconUrl: "/logo-icon.svg",
  faviconUrl: "/favicon.ico",
  primaryColor: "222.2 47.4% 11.2%",
  primaryForeground: "210 40% 98%",
  footerText: "Zimark IT Support Portal",
  supportEmail: "it-support@zimark.com",
  slackChannel: "#it-help",
  cssClass: "theme-zimark",
};

/**
 * Loads branding from env or returns defaults.
 * In a multi-tenant setup, this would load from database based on hostname or org ID.
 */
export function getBranding(): OrgBranding {
  if (process.env.ORG_BRANDING) {
    try {
      const custom = JSON.parse(process.env.ORG_BRANDING);
      return { ...DEFAULT_BRANDING, ...custom };
    } catch {
      console.warn("Failed to parse ORG_BRANDING env var, using defaults");
    }
  }
  return DEFAULT_BRANDING;
}

/**
 * Generate CSS variables from branding config.
 * Inject these into the root layout.
 */
export function brandingCssVars(branding: OrgBranding): string {
  return `
    :root {
      --primary: ${branding.primaryColor};
      --primary-foreground: ${branding.primaryForeground};
    }
  `;
}
