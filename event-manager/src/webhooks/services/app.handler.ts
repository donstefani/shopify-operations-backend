import { WebhookRequest, WebhookHandlerResult, WEBHOOK_TOPICS } from '../types/index';
import { BaseWebhookHandler } from './base.handler';

/**
 * App Webhook Handler
 * 
 * Processes app-related webhooks (uninstalled, etc.)
 */
export class AppWebhookHandler extends BaseWebhookHandler {
  async handle(data: any, req: WebhookRequest): Promise<WebhookHandlerResult> {
    const topic = req.webhookTopic || 'unknown';
    const shop = req.webhookShop || 'unknown';
    
    // Log event
    await this.logEvent(topic, shop, data);
    
    try {
      let result: WebhookHandlerResult;
      
      switch (topic) {
        case WEBHOOK_TOPICS.APP_UNINSTALLED:
          result = await this.handleAppUninstalled(data, shop);
          break;
        default:
          result = {
            success: false,
            message: `Unsupported app webhook topic: ${topic}`
          };
      }
      
      return result;
    } catch (error) {
      console.error('App webhook handler error:', error);
      
      return {
        success: false,
        message: 'Failed to process app webhook',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  private async handleAppUninstalled(data: any, shop: string): Promise<WebhookHandlerResult> {
    console.log(`App uninstalled from shop ${shop}:`, {
      shopId: data.id,
      shopDomain: data.domain,
      uninstalledAt: new Date().toISOString()
    });
    
    // TODO: Implement app uninstallation cleanup logic
    // Future tasks:
    // - Revoke access tokens (call auth-service)
    // - Archive/delete shop data from DynamoDB tables
    // - Send uninstallation notification
    // - Update analytics
    
    return {
      success: true,
      message: 'App uninstallation webhook processed successfully',
      data: { shopId: data.id, action: 'uninstalled' }
    };
  }
}

