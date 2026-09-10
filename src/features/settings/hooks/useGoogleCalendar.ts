import { invoke } from "@tauri-apps/api/core";

export interface GoogleStatus {
  connected: boolean;
  enabled: boolean;
  account_email: string | null;
  calendar_id: string | null;
  has_client_id: boolean;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret?: string | null;
  calendarId?: string | null;
  timeZone?: string | null;
}

export function useGoogleCalendar() {
  /** Read the current connection status. */
  const getStatus = async (): Promise<GoogleStatus> => {
    return invoke<GoogleStatus>("google_auth_status");
  };

  /** Persist the OAuth client credentials and calendar preferences (Master only). */
  const saveConfig = async (config: GoogleConfig): Promise<void> => {
    return invoke<void>("google_set_config", {
      clientId: config.clientId,
      clientSecret: config.clientSecret ?? null,
      calendarId: config.calendarId ?? null,
      timeZone: config.timeZone ?? null,
    });
  };

  /**
   * Start the OAuth flow. Opens the system browser and resolves once the user
   * finishes authorizing. Returns the connected account label. This call blocks
   * on the backend until the flow completes or times out (~5 min).
   */
  const connect = async (): Promise<string> => {
    return invoke<string>("google_auth_start");
  };

  /** Disconnect and revoke access (Master only). */
  const disconnect = async (): Promise<void> => {
    return invoke<void>("google_disconnect");
  };

  /** Force a manual re-sync of a single appointment. */
  const syncAppointment = async (appointmentId: number): Promise<void> => {
    return invoke<void>("google_sync_appointment", { appointmentId });
  };

  /**
   * List Google Calendar events in a range, flagged as external or not.
   * Dates MUST be RFC3339 UTC instants (use Date.toISOString()).
   * Returns [] when not connected.
   */
  const listExternalEvents = async (
    dateFromISO: string,
    dateToISO: string,
  ): Promise<GoogleEvent[]> => {
    return invoke<GoogleEvent[]>("google_list_external_events", {
      dateFrom: dateFromISO,
      dateTo: dateToISO,
    });
  };

  return { getStatus, saveConfig, connect, disconnect, syncAppointment, listExternalEvents };
}

export interface GoogleEvent {
  google_event_id: string;
  summary: string;
  start_time: string;
  end_time: string;
  is_external: boolean;
}
