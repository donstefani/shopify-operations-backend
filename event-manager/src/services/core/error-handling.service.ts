import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { 
  ErrorSeverity, 
  ErrorCategory, 
  ErrorContext, 
  ErrorNotificationConfig, 
  ErrorTracking,
  IErrorHandlingService
} from '../../types/errors.types';
import { ErrorContextSchema } from '../../schemas/validation.schemas';

/**
 * Error Handling Service
 * 
 * Centralized error management with email notifications for critical failures.
 * Handles error categorization, logging, and alerting.
 */

export class ErrorHandlingService implements IErrorHandlingService {
  private transporter: Transporter | null = null;
  private config: ErrorNotificationConfig;
  private tracking: ErrorTracking;
  private isInitialized = false;

  constructor(config?: Partial<ErrorNotificationConfig>) {
    this.config = this.mergeWithDefaults(config);
    this.tracking = {
      lastEmailSent: new Map(),
      emailCounts: {
        hourly: new Map(),
        daily: new Map()
      }
    };
  }

  /**
   * Initialize the email transporter
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (this.config.email.enabled) {
        this.transporter = nodemailer.createTransport({
          host: this.config.email.smtp.host,
          port: this.config.email.smtp.port,
          secure: this.config.email.smtp.secure,
          auth: this.config.email.smtp.auth,
          tls: {
            rejectUnauthorized: false // For shared hosting SSL issues
          }
        });

        // Verify connection
        if (this.transporter) {
          await this.transporter.verify();
        }
        console.log('✅ Email service initialized successfully');
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
      // Don't throw - we can still log errors even if email fails
    }
  }

  /**
   * Handle and categorize an error
   */
  async handleError(
    error: Error | unknown,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    context?: ErrorContext
  ): Promise<void> {
    try {
      // Validate context
      const validatedContext = context ? ErrorContextSchema.parse(context) : undefined;

      // Log the error
      this.logError(error, severity, category, validatedContext);

      // Send email notification if severity meets threshold
      if (this.shouldSendNotification(severity, category, validatedContext)) {
        await this.sendErrorNotification(error, severity, category, validatedContext);
      }
    } catch (notificationError) {
      // Don't let notification errors crash the app
      console.error('Failed to send error notification:', notificationError);
    }
  }

  /**
   * Handle critical errors that crash the app
   */
  async handleCriticalError(
    error: Error | unknown,
    context?: ErrorContext
  ): Promise<void> {
    await this.handleError(
      error,
      ErrorSeverity.CRITICAL,
      ErrorCategory.SYSTEM,
      context
    );
  }

  /**
   * Handle webhook processing errors
   */
  async handleWebhookError(
    error: Error | unknown,
    webhookTopic: string,
    shopDomain: string,
    context?: Partial<ErrorContext>
  ): Promise<void> {
    await this.handleError(
      error,
      ErrorSeverity.HIGH,
      ErrorCategory.WEBHOOK_PROCESSING,
      {
        ...context,
        webhookTopic,
        shopDomain,
        service: 'webhook-processor'
      }
    );
  }

  /**
   * Handle GraphQL API errors
   */
  async handleGraphQLError(
    error: Error | unknown,
    operation: string,
    shopDomain: string,
    context?: Partial<ErrorContext>
  ): Promise<void> {
    await this.handleError(
      error,
      ErrorSeverity.HIGH,
      ErrorCategory.GRAPHQL_API,
      {
        ...context,
        operation,
        shopDomain,
        service: 'graphql-client'
      }
    );
  }

  /**
   * Log error with structured format
   */
  private logError(
    error: Error | unknown,
    severity: ErrorSeverity,
    category: ErrorCategory,
    context?: ErrorContext
  ): void {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      severity,
      category,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context
    };

    // Use appropriate log level based on severity
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        console.error('🚨 CRITICAL ERROR:', errorInfo);
        break;
      case ErrorSeverity.HIGH:
        console.error('🔴 HIGH SEVERITY ERROR:', errorInfo);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('🟡 MEDIUM SEVERITY ERROR:', errorInfo);
        break;
      case ErrorSeverity.LOW:
        console.info('🔵 LOW SEVERITY ERROR:', errorInfo);
        break;
    }
  }

  /**
   * Determine if notification should be sent
   */
  private shouldSendNotification(
    severity: ErrorSeverity,
    category: ErrorCategory,
    context?: ErrorContext
  ): boolean {
    if (!this.config.email.enabled) return false;

    // Check severity threshold
    const severityLevels = [ErrorSeverity.LOW, ErrorSeverity.MEDIUM, ErrorSeverity.HIGH, ErrorSeverity.CRITICAL];
    const currentLevel = severityLevels.indexOf(severity);
    const thresholdLevel = severityLevels.indexOf(this.config.severityThreshold);
    
    if (currentLevel < thresholdLevel) return false;

    // Check rate limiting
    if (this.config.rateLimit.enabled) {
      const errorKey = `${category}-${context?.shopDomain || 'unknown'}`;
      if (!this.isWithinRateLimit(errorKey)) return false;
    }

    return true;
  }

  /**
   * Send error notification email
   */
  private async sendErrorNotification(
    error: Error | unknown,
    severity: ErrorSeverity,
    category: ErrorCategory,
    context?: ErrorContext
  ): Promise<void> {
    if (!this.transporter) {
      console.warn('Email transporter not initialized');
      return;
    }

    const errorKey = `${category}-${context?.shopDomain || 'unknown'}`;
    const now = Date.now();

    try {
      const subject = `🚨 ${severity.toUpperCase()} Error in Shopify Event Processor`;
      const html = this.generateErrorEmailHTML(error, severity, category, context);

      await this.transporter.sendMail({
        from: this.config.email.from,
        to: this.config.email.to,
        subject,
        html
      });

      // Update tracking
      this.tracking.lastEmailSent.set(errorKey, now);
      this.updateEmailCounts(errorKey);

      console.log(`📧 Error notification sent for ${category} error`);
    } catch (emailError) {
      console.error('Failed to send error notification email:', emailError);
    }
  }

  /**
   * Generate HTML email content
   */
  private generateErrorEmailHTML(
    error: Error | unknown,
    severity: ErrorSeverity,
    category: ErrorCategory,
    context?: ErrorContext
  ): string {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : 'No stack trace available';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; }
          .error-details { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .context { background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .stack-trace { background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 10px 0; font-family: monospace; white-space: pre-wrap; }
          .severity-critical { border-left: 5px solid #dc3545; }
          .severity-high { border-left: 5px solid #fd7e14; }
          .severity-medium { border-left: 5px solid #ffc107; }
          .severity-low { border-left: 5px solid #28a745; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚨 Shopify Event Processor Error Alert</h1>
          <p><strong>Timestamp:</strong> ${timestamp}</p>
          <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
          <p><strong>Category:</strong> ${category}</p>
        </div>

        <div class="error-details severity-${severity}">
          <h2>Error Details</h2>
          <p><strong>Message:</strong> ${errorMessage}</p>
        </div>

        ${context ? `
        <div class="context">
          <h2>Context Information</h2>
          <ul>
            ${context.service ? `<li><strong>Service:</strong> ${context.service}</li>` : ''}
            ${context.operation ? `<li><strong>Operation:</strong> ${context.operation}</li>` : ''}
            ${context.shopDomain ? `<li><strong>Shop Domain:</strong> ${context.shopDomain}</li>` : ''}
            ${context.webhookTopic ? `<li><strong>Webhook Topic:</strong> ${context.webhookTopic}</li>` : ''}
            ${context.requestId ? `<li><strong>Request ID:</strong> ${context.requestId}</li>` : ''}
            ${context.userId ? `<li><strong>User ID:</strong> ${context.userId}</li>` : ''}
          </ul>
          ${context.additionalData ? `
            <h3>Additional Data:</h3>
            <pre>${JSON.stringify(context.additionalData, null, 2)}</pre>
          ` : ''}
        </div>
        ` : ''}

        <div class="stack-trace">
          <h2>Stack Trace</h2>
          <pre>${stackTrace}</pre>
        </div>

        <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px;">
          <p><strong>Action Required:</strong> Please investigate this error and take appropriate action.</p>
          <p><strong>Service:</strong> Shopify Event Processor</p>
          <p><strong>Environment:</strong> ${process.env['NODE_ENV'] || 'unknown'}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Check if within rate limit
   */
  private isWithinRateLimit(errorKey: string): boolean {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Check hourly limit
    const hourlyCount = this.tracking.emailCounts.hourly.get(errorKey) || 0;
    if (hourlyCount >= this.config.rateLimit.maxEmailsPerHour) {
      const lastSent = this.tracking.lastEmailSent.get(errorKey) || 0;
      if (now - lastSent < oneHour) {
        return false;
      }
    }

    // Check daily limit
    const dailyCount = this.tracking.emailCounts.daily.get(errorKey) || 0;
    if (dailyCount >= this.config.rateLimit.maxEmailsPerDay) {
      return false;
    }

    return true;
  }

  /**
   * Update email counts for rate limiting
   */
  private updateEmailCounts(errorKey: string): void {
    const oneHour = 60 * 60 * 1000;

    // Update hourly count
    const hourlyCount = this.tracking.emailCounts.hourly.get(errorKey) || 0;
    this.tracking.emailCounts.hourly.set(errorKey, hourlyCount + 1);

    // Update daily count
    const dailyCount = this.tracking.emailCounts.daily.get(errorKey) || 0;
    this.tracking.emailCounts.daily.set(errorKey, dailyCount + 1);

    // Clean up old entries (simple cleanup - could be more sophisticated)
    setTimeout(() => {
      this.tracking.emailCounts.hourly.delete(errorKey);
    }, oneHour);

    setTimeout(() => {
      this.tracking.emailCounts.daily.delete(errorKey);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaults(config?: Partial<ErrorNotificationConfig>): ErrorNotificationConfig {
    return {
      email: {
        enabled: config?.email?.enabled ?? (process.env['ERROR_EMAIL_ENABLED'] === 'true'),
        from: config?.email?.from ?? process.env['ERROR_EMAIL_FROM'] ?? 'noreply@donstefani.com',
        to: config?.email?.to ?? (process.env['ERROR_EMAIL_TO'] ? process.env['ERROR_EMAIL_TO'].split(',') : ['dstefani@donstefani.com']),
        smtp: {
          host: config?.email?.smtp?.host ?? process.env['SMTP_HOST'] ?? 'mail.donstefani.com',
          port: config?.email?.smtp?.port ?? parseInt(process.env['SMTP_PORT'] ?? '465'),
          secure: config?.email?.smtp?.secure ?? true,
          auth: {
            user: config?.email?.smtp?.auth?.user ?? process.env['SMTP_USER'] ?? 'dstefani@donstefani.com',
            pass: config?.email?.smtp?.auth?.pass ?? process.env['SMTP_PASS'] ?? 'LindaLove0214$'
          }
        }
      },
      severityThreshold: config?.severityThreshold ?? ErrorSeverity.HIGH,
      rateLimit: {
        enabled: config?.rateLimit?.enabled ?? true,
        maxEmailsPerHour: config?.rateLimit?.maxEmailsPerHour ?? 5,
        maxEmailsPerDay: config?.rateLimit?.maxEmailsPerDay ?? 20
      }
    };
  }
}

// Export singleton instance
export const errorHandlingService = new ErrorHandlingService();
