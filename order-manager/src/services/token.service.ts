import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

export class TokenService {
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly encryptionKey: string;

  constructor() {
    this.dynamoClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: process.env.AWS_REGION || 'us-east-1',
      })
    );
    this.tableName = process.env.AUTH_TABLE || 'portfolio-shopify-auth';
    this.encryptionKey = process.env.ENCRYPTION_KEY || '';
  }

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

  async getAccessToken(shopDomain: string): Promise<{ accessToken: string; scopes: string } | null> {
    try {
      const result = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { id: `token:${shopDomain}` },
        })
      );

      if (!result.Item) {
        console.error(`No token found for shop: ${shopDomain}`);
        return null;
      }

      const decryptedToken = this.decrypt(result.Item.encryptedToken);
      return {
        accessToken: decryptedToken,
        scopes: result.Item.scopes,
      };
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  }
}

