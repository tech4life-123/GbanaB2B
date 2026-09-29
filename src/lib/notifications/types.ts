/**
 * Notification contract (INTERFACE ONLY — Phase 1).
 *
 * Domain services emit a `NotificationEvent`; a dispatcher (Phase 3+) fans it
 * out to channels according to user preferences. Channels are adapters so an
 * SMS gateway or push service can change without touching business logic.
 * WhatsApp is a share/deep-link channel only — never a system of record.
 */

export type NotificationChannel = "in_app" | "push" | "sms" | "whatsapp_link";

export type NotificationEventType =
  | "order.received"
  | "order.accepted"
  | "freight.requested"
  | "freight.carrier_eligible"
  | "freight.bid_received"
  | "freight.carrier_selected"
  | "payment.confirmed"
  | "escrow.funded"
  | "shipment.dispatched"
  | "shipment.approaching"
  | "shipment.delivered"
  | "dispute.opened"
  | "dispute.resolved";

export interface NotificationEvent {
  type: NotificationEventType;
  recipientUserId: string;
  /** Entity the notification is about, for deep links. */
  entity: { type: string; id: string };
  title: string;
  body: string;
  /** Idempotency key so retries never double-send an SMS. */
  dedupeKey: string;
}

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  isConfigured(): boolean;
  send(event: NotificationEvent): Promise<{ delivered: boolean; providerId?: string }>;
}

/** Builds a WhatsApp share link. The app remains the source of truth. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
