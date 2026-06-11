/**
 * Shared types consumed by both the API and the mobile client.
 * Kept framework-agnostic (no runtime code) so either side can import freely.
 */

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}
