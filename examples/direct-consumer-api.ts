import { Connection, ConsumerOptions } from '../src/index';
import { ConsumeMessage } from 'amqplib';

/**
 * Example: Using the Direct Consumer API
 * 
 * This example shows the lower-level consume method that gives you direct access
 * to message acknowledgment and retry functions for more control.
 */

async function directConsumerExample() {
  console.log('🚀 Starting Direct Consumer Example...\n');

  // Initialize connection
  const rabbit = new Connection('amqp://guest:guest@localhost:5672', {
    maxRetries: 3,
    retryDelay: 5000,
    heartbeat: 30
  });

  // Setup event handlers
  rabbit.on('error', (err) => {
    console.error('❌ Connection error:', err);
  });

  rabbit.on('connection', () => {
    console.log('✅ Connection established!');
  });

  try {
    // Declare the queue first (optional, but good practice)
    await rabbit.queueDeclare('direct-consumer-queue', { durable: true });
    
    // Define consumer options
    const consumerOptions: ConsumerOptions = {
      prefetch: 1,                    // Process 1 message at a time
      retryAttempts: 3,               // Retry failed messages up to 3 times
      retryDelayMs: 5000,             // Wait 5 seconds between retries
      deadLetterQueueSuffix: '.dlq',  // Send to DLQ after retries exhausted
      processingTimeout: 30000        // Timeout message processing after 30 seconds
    };

    // Use the direct consume method
    await rabbit.consume(
      'direct-consumer-queue',              // Queue name
      async (msg: ConsumeMessage, ack, retry) => {  // Message handler with direct ack/retry
        try {
          // Parse the message content
          const messageContent = JSON.parse(msg.content.toString());
          console.log('📥 Received message:', messageContent);
          
          // Your business logic here
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
          
          // Example: Different processing based on message content
          if (messageContent.type === 'critical') {
            console.log('⚠️ Processing critical message with extra care...');
            // Perform critical processing
          } else {
            console.log('📄 Processing regular message...');
            // Perform regular processing
          }
          
          // Explicitly acknowledge the message when processing is successful
          ack();
          console.log('✅ Message acknowledged and removed from queue');
          
        } catch (error) {
          console.error('❌ Error processing message:', error);
          
          // You have full control over what happens on error:
          // 1. Call retry() to requeue the message for another attempt
          // 2. Call ack() to acknowledge and remove the message (if you want to drop it on error)
          // 3. Just let the error propagate and rely on library's built-in retry logic
          retry(); // Retry the message according to consumer options
        }
      },
      consumerOptions  // Consumer configuration options
    );

    console.log('👂 Consumer is now listening for messages using direct API...');
    console.log('Messages will be consumed with manual acknowledgment control.\n');

    // Create a publisher to send test messages
    const publisher = await rabbit.createPublisher({
      confirm: true,
      maxAttempts: 2
    });

    // Send test messages
    console.log('Sending test messages...\n');
    
    await publisher.send('direct-consumer-queue', {
      id: 1,
      type: 'regular',
      content: 'This is a regular test message',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Sent regular test message');
    
    await publisher.send('direct-consumer-queue', {
      id: 2,
      type: 'critical',
      content: 'This is a critical test message',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Sent critical test message');

    // Keep the example running to see message processing
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Note: With the direct consume method, there's no easy way to stop the consumer
    // since we don't get a reference back. For more control, use createConsumer instead.
    
    await publisher.close();
    console.log('✅ Publisher closed');
    
    await rabbit.close();
    console.log('✅ Connection closed');
    
  } catch (error) {
    console.error('❌ Error in direct consumer example:', error);
    
    try {
      await rabbit.close();
    } catch (closeError) {
      console.error('❌ Error closing connection:', closeError);
    }
  }
}

// Run the example
directConsumerExample().catch(console.error);