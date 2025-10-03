/**
 * Database service for event-manager microservice
 * Integrates with shared database configuration and provides webhook-specific database operations
 */

import { DatabaseConnection, getEventManagerDbConfig } from '@operations-manager/shared/database';

export interface WebhookEventData {
  id?: number;
  shop_domain: string;
  topic: string;
  event_data: any;
  processed_at: Date;
  status: 'pending' | 'processed' | 'failed';
  error_message?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface RegisteredWebhookData {
  id?: number;
  shop_domain: string;
  topic: string;
  webhook_url: string;
  webhook_id: number;
  status: 'active' | 'inactive';
  created_at?: Date;
  updated_at?: Date;
}

export class EventManagerDatabaseService {
  private db: DatabaseConnection;

  constructor() {
    // Initialize with event-manager specific database configuration
    this.db = DatabaseConnection.getInstance(getEventManagerDbConfig());
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    await this.db.connect();
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.db.disconnect();
  }

  /**
   * Create a new webhook event record
   * @param eventData Webhook event data to store
   * @returns Promise<number> - ID of the created event record
   */
  async createWebhookEvent(eventData: Omit<WebhookEventData, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.db.execute(
      `INSERT INTO webhook_events 
       (shop_domain, topic, event_data, processed_at, status, error_message) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        eventData.shop_domain,
        eventData.topic,
        JSON.stringify(eventData.event_data),
        eventData.processed_at,
        eventData.status,
        eventData.error_message || null
      ]
    );
    return (result as any)[0].insertId;
  }

  /**
   * Update webhook event status
   * @param id Event record ID
   * @param status New status
   * @param errorMessage Optional error message
   */
  async updateWebhookEventStatus(id: number, status: string, errorMessage?: string): Promise<void> {
    await this.db.execute(
      `UPDATE webhook_events 
       SET status = ?, error_message = ?, updated_at = NOW() 
       WHERE id = ?`,
      [status, errorMessage || null, id]
    );
  }

  /**
   * Get webhook events for a specific shop
   * @param shopDomain Shop domain to query
   * @param limit Maximum number of records to return
   * @returns Promise<WebhookEventData[]> - Array of webhook events
   */
  async getWebhookEventsByShop(shopDomain: string, limit = 100): Promise<WebhookEventData[]> {
    const rows = await this.db.queryAll(
      `SELECT * FROM webhook_events 
       WHERE shop_domain = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [shopDomain, limit]
    );
    return rows;
  }

  /**
   * Get webhook events by topic
   * @param topic Webhook topic to query
   * @param limit Maximum number of records to return
   * @returns Promise<WebhookEventData[]> - Array of webhook events
   */
  async getWebhookEventsByTopic(topic: string, limit = 100): Promise<WebhookEventData[]> {
    const rows = await this.db.queryAll(
      `SELECT * FROM webhook_events 
       WHERE topic = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [topic, limit]
    );
    return rows;
  }

  /**
   * Get webhook events by status
   * @param status Event status to query
   * @param limit Maximum number of records to return
   * @returns Promise<WebhookEventData[]> - Array of webhook events
   */
  async getWebhookEventsByStatus(status: string, limit = 100): Promise<WebhookEventData[]> {
    const rows = await this.db.queryAll(
      `SELECT * FROM webhook_events 
       WHERE status = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [status, limit]
    );
    return rows;
  }

  /**
   * Create a registered webhook record
   * @param webhookData Registered webhook data to store
   * @returns Promise<number> - ID of the created webhook record
   */
  async createRegisteredWebhook(webhookData: Omit<RegisteredWebhookData, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.db.execute(
      `INSERT INTO registered_webhooks 
       (shop_domain, topic, webhook_url, webhook_id, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        webhookData.shop_domain,
        webhookData.topic,
        webhookData.webhook_url,
        webhookData.webhook_id,
        webhookData.status
      ]
    );
    return (result as any)[0].insertId;
  }

  /**
   * Get registered webhooks for a specific shop
   * @param shopDomain Shop domain to query
   * @returns Promise<RegisteredWebhookData[]> - Array of registered webhooks
   */
  async getRegisteredWebhooksByShop(shopDomain: string): Promise<RegisteredWebhookData[]> {
    const rows = await this.db.queryAll(
      `SELECT * FROM registered_webhooks 
       WHERE shop_domain = ? 
       ORDER BY created_at DESC`,
      [shopDomain]
    );
    return rows;
  }

  /**
   * Update registered webhook status
   * @param id Registered webhook record ID
   * @param status New status
   */
  async updateRegisteredWebhookStatus(id: number, status: string): Promise<void> {
    await this.db.execute(
      `UPDATE registered_webhooks 
       SET status = ?, updated_at = NOW() 
       WHERE id = ?`,
      [status, id]
    );
  }

  /**
   * Delete a registered webhook
   * @param id Registered webhook record ID
   */
  async deleteRegisteredWebhook(id: number): Promise<void> {
    await this.db.execute(
      `DELETE FROM registered_webhooks WHERE id = ?`,
      [id]
    );
  }

  /**
   * Get webhook statistics for a shop
   * @param shopDomain Shop domain to query
   * @returns Promise with webhook statistics
   */
  async getWebhookStats(shopDomain: string): Promise<{
    total_events: number;
    processed_events: number;
    failed_events: number;
    pending_events: number;
    registered_webhooks: number;
  }> {
    const [totalResult] = await this.db.execute(
      `SELECT COUNT(*) as total FROM webhook_events WHERE shop_domain = ?`,
      [shopDomain]
    );
    
    const [processedResult] = await this.db.execute(
      `SELECT COUNT(*) as processed FROM webhook_events WHERE shop_domain = ? AND status = 'processed'`,
      [shopDomain]
    );
    
    const [failedResult] = await this.db.execute(
      `SELECT COUNT(*) as failed FROM webhook_events WHERE shop_domain = ? AND status = 'failed'`,
      [shopDomain]
    );
    
    const [pendingResult] = await this.db.execute(
      `SELECT COUNT(*) as pending FROM webhook_events WHERE shop_domain = ? AND status = 'pending'`,
      [shopDomain]
    );
    
    const [registeredResult] = await this.db.execute(
      `SELECT COUNT(*) as registered FROM registered_webhooks WHERE shop_domain = ?`,
      [shopDomain]
    );

    return {
      total_events: (totalResult as any)[0].total,
      processed_events: (processedResult as any)[0].processed,
      failed_events: (failedResult as any)[0].failed,
      pending_events: (pendingResult as any)[0].pending,
      registered_webhooks: (registeredResult as any)[0].registered
    };
  }
}

export default EventManagerDatabaseService;
