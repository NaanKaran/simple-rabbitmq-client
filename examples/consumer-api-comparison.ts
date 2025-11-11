import { Connection, ConsumerOptions } from '../src/index';
import { ConsumeMessage } from 'amqplib';

/**
 * Comparison: Enhanced vs Direct Consumer APIs
 * 
 * This example demonstrates both approaches to consuming messages,
 * showing when to use each one.
 */

async function comparisonExample() {
  console.log('🚀 Consumer API Comparison Example\n');

  const rabbit = new Connection('amqp://guest:guest@localhost:5672', {
    maxRetries: 3,
    retryDelay: 5000,
    heartbeat: 30
  });

  rabbit.on('error', (err) => console.error('❌ Connection error:', err));
  rabbit.on('connection', () => console.log('✅ Connection established'));

  try {
    // Setup: Declare queues for our examples
    await rabbit.queueDeclare('enhanced-api-queue', { durable: true });
    await rabbit.queueDeclare('direct-api-queue', { durable: true });

    // ============ ENHANCED API ============
    console.log('--- ENHANCED API CONSUMER ---');
    console.log('✅ Automatic acknowledgment based on function success/failure\n');

    const enhancedConsumer = await rabbit.createConsumer({
      queue: 'enhanced-api-queue',
      queueOptions: { durable: true },
      qos: { prefetchCount: 1 }
    }, async (msg) => {
      console.log('📥 Enhanced API received:', msg);
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // AUTOMATIC ACKNOWLEDGMENT:
      // ✅ If function completes: message is auto-acked
      // ❌ If function throws: message is auto-nacked/retried
      // No manual ack() needed!
      
      if (msg.shouldFail) {
        throw new Error('Simulated processing failure');
      }
      
      console.log('✅ Enhanced API message processed successfully');
    });

    enhancedConsumer.on('error', (err) => {
      console.error('❌ Enhanced consumer error:', err);
    });

    // ============ DIRECT API ============
    console.log('\n--- DIRECT API CONSUMER ---');
    console.log('🔧 Manual acknowledgment control with ack() and retry()\n');

    const directOptions: ConsumerOptions = {
      prefetch: 1,
      retryAttempts: 2,
      retryDelayMs: 3000
    };

    await rabbit.consume(
      'direct-api-queue',
      async (msg: ConsumeMessage, ack, retry) => {
        console.log('📥 Direct API received:', JSON.parse(msg.content.toString()));
        
        try {
          // Simulate processing
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // CUSTOM LOGIC WITH MANUAL CONTROL:
          const message = JSON.parse(msg.content.toString());
          
          if (message.type === 'critical') {
            console.log('⚠️ Processing critical message...');
            // Maybe we want special handling for critical messages
            if (message.attempt > 3) {
              console.log('Critical message failed after 3 attempts, routing elsewhere...');
              // Could send to a special handling queue
            }
          }
          
          // MANUALLY ACKNOWLEDGE when ready
          ack();
          console.log('✅ Direct API message acknowledged');
          
        } catch (error) {
          console.error('❌ Direct API error:', error);
          
          // CUSTOM RETRY LOGIC based on error type
          if (error.message?.includes('transient')) {
            console.log('Transient error, will retry...');
            retry();  // Retry the message
          } else {
            console.log('Permanent error, acknowledging to prevent retry...');
            ack();    // Acknowledge to remove from queue (don't retry permanent errors)
          }
        }
      },
      directOptions
    );

    // ============ TEST THE CONSUMERS ============
    console.log('\n--- SENDING TEST MESSAGES ---');
    
    const publisher = await rabbit.createPublisher({ confirm: true });
    
    // Send test message to enhanced API consumer
    await publisher.send('enhanced-api-queue', { 
      id: 1, 
      content: 'Enhanced API test', 
      timestamp: new Date().toISOString() 
    });
    console.log('✅ Sent message 1 to Enhanced API');
    
    // Send message that will fail to test error handling
    await publisher.send('enhanced-api-queue', { 
      id: 2, 
      content: 'Enhanced API failure test', 
      shouldFail: true,
      timestamp: new Date().toISOString() 
    });
    console.log('✅ Sent failure test to Enhanced API');
    
    // Send test message to direct API consumer
    await publisher.send('direct-api-queue', { 
      id: 3, 
      content: 'Direct API test', 
      type: 'regular',
      timestamp: new Date().toISOString() 
    });
    console.log('✅ Sent message to Direct API');
    
    // Send critical message to direct API consumer
    await publisher.send('direct-api-queue', { 
      id: 4, 
      content: 'Critical message', 
      type: 'critical',
      attempt: 1,
      timestamp: new Date().toISOString() 
    });
    console.log('✅ Sent critical message to Direct API');
    
    // Keep running to see message processing
    console.log('\n--- CONSUMERS ARE LISTENING ---');
    console.log('Enhanced API: Automatic ack/nack based on function success/failure');
    console.log('Direct API: Manual control with ack() and retry() functions');
    console.log('Waiting for message processing...\n');
    
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Cleanup
    await enhancedConsumer.close();
    await publisher.close();
    await rabbit.close();
    console.log('\n✅ Cleanup completed');
    
  } catch (error) {
    console.error('❌ Error in comparison example:', error);
    await rabbit.close();
  }
}

comparisonExample().catch(console.error);