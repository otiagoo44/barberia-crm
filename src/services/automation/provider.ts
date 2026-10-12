/** Provider boundary: only a worker with a leased job should call an adapter.
 * Appointments commit before delivery. No provider is enabled by default.
 */
export type DeliveryResult = { providerReference: string; deliveredAt: string };
export interface AutomationProvider {
  readonly name: string;
  deliver(input: {
    jobId: string;
    idempotencyKey: string;
    organizationId: string;
    eventType: string;
    recipient: string;
    template: string;
    variables: Record<string, string>;
  }): Promise<DeliveryResult>;
}
