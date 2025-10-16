import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Simplified Token Manager Service
 * 
 * Handles token storage, encryption, and retrieval with DynamoDB
 */

export class TokenManagerService {
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly encryptionKey: string;

  constructor() {
    this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1'
    }));
    this.tableName = process.env.AWS_DYNAMODB_TABLE || 'shopify-auth-tokens';
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production';
  }

  /**
   * Generate a secure random state parameter
   */
  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store OAuth state in DynamoDB for validation
   */
  async storeOAuthState(state: string, shopDomain: string): Promise<void> {
    const params = {
      TableName: this.tableName,
      Item: {
        id: `oauth_state:${state}`,
        shopDomain,
        createdAt: new Date().toISOString()
      }
    };

    await this.dynamoClient.send(new PutCommand(params));
  }

  /**
   * Validate and consume OAuth state
   */
  async validateOAuthState(state: string): Promise<{ valid: boolean; shopDomain?: string }> {
    try {
      const params = {
        TableName: this.tableName,
        Key: {
          id: `oauth_state:${state}`
        }
      };

      const result = await this.dynamoClient.send(new GetCommand(params));
      
      if (!result.Item) {
        return { valid: false };
      }

      // Delete the state after validation (single-use)
      await this.dynamoClient.send(new DeleteCommand(params));

      return { 
        valid: true, 
        shopDomain: result.Item.shopDomain 
      };
    } catch (error) {
      console.error('Error validating OAuth state:', error);
      return { valid: false };
    }
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Store encrypted token in DynamoDB
   */
  async storeToken(shopDomain: string, accessToken: string, scopes: string): Promise<void> {
    const encryptedToken = this.encrypt(accessToken);
    const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

    await this.dynamoClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        id: `token:${shopDomain}`,
        encryptedToken,
        scopes,
        createdAt: new Date().toISOString(),
        ttl
      }
    }));
  }

  /**
   * Retrieve and decrypt token from DynamoDB
   */
  async getToken(shopDomain: string): Promise<{ accessToken: string; scopes: string } | null> {
    try {
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { id: `token:${shopDomain}` }
      }));

      if (!result.Item) {
        return null;
      }

      const decryptedToken = this.decrypt(result.Item.encryptedToken);
      return {
        accessToken: decryptedToken,
        scopes: result.Item.scopes
      };
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  }

  /**
   * Delete token from DynamoDB
   */
  async deleteToken(shopDomain: string): Promise<void> {
    await this.dynamoClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { id: `token:${shopDomain}` }
    }));
  }
}
