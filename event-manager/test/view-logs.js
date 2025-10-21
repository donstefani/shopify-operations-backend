// view-logs.js

const { CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

const logGroupName = '/aws/lambda/operations-event-manager-dev-webhook-processor';

async function viewRecentLogs() {
  const client = new CloudWatchLogsClient({ region: 'us-east-1' });
  
  // Get logs from the last 10 minutes
  const startTime = Date.now() - (10 * 60 * 1000);
  
  console.log('🔍 Fetching recent CloudWatch logs...\n');
  
  try {
    const command = new FilterLogEventsCommand({
      logGroupName: logGroupName,
      startTime: startTime,
      limit: 100
    });
    
    const response = await client.send(command);
    
    if (!response.events || response.events.length === 0) {
      console.log('No recent log events found.');
      return;
    }
    
    console.log(`Found ${response.events.length} log events:\n`);
    console.log('='.repeat(80));
    
    response.events.forEach(event => {
      const timestamp = new Date(event.timestamp).toISOString();
      const message = event.message;
      
      // Highlight errors and warnings
      if (message.includes('ERROR') || message.includes('Error') || message.includes('error')) {
        console.log(`\n🔴 [${timestamp}]`);
        console.log(message);
      } else if (message.includes('WARN') || message.includes('warn')) {
        console.log(`\n⚠️  [${timestamp}]`);
        console.log(message);
      } else if (message.includes('Product') || message.includes('Order') || message.includes('Customer')) {
        console.log(`\n📊 [${timestamp}]`);
        console.log(message);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('Error fetching logs:', error.message);
    
    if (error.name === 'ResourceNotFoundException') {
      console.log('\n💡 The log group might not exist yet. Try running the webhook tests first.');
    }
  }
}

viewRecentLogs();