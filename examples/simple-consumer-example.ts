import { Connection } from '../src/index';

/**
 * Simple Consumer Example
 * 
 * This example shows the most basic way to set up a consumer with clear explanations
 */

async function simpleConsumerExample() {
  console.log('🚀 Starting Simple Consumer Example...\n');

  // 1. CREATE CONNECTION
  // Initialize connection to RabbitMQ server
  const rabbit = new Connection('amqp://guest:guest@localhost:5672', {
    maxRetries: 3,        // If connection fails, retry up to 3 times
    retryDelay: 5000,     // Wait 5 seconds between retries
    heartbeat: 30         // Send heartbeat every 30 seconds to keep connection alive
  });

  // Listen for connection events
  rabbit.on('error', (err) => {
    console.error('❌ Connection error:', err);
  });

  rabbit.on('connection', () => {
    console.log('✅ Connection established!');
  });

  try {
    // 2. CREATE CONSUMER
    // This creates a consumer that listens to a queue and processes incoming messages
    const consumer = await rabbit.createConsumer({
      // Queue configuration
      queue: 'my-test-queue',           // Name of the queue to consume from
      
      // Queue options (optional) - declare the queue if it doesn't exist
      queueOptions: { 
        durable: true                   // Queue will survive server restarts
      },
      
      // Quality of Service - control how many messages to process concurrently
      qos: { 
        prefetchCount: 1               // Process 1 message at a time (default)
      },
      
      // Exchange configuration (optional) - declare exchanges if needed
      exchanges: [
        { 
          exchange: 'my-exchange',      // Name of exchange
          type: 'topic'                 // Type: direct, topic, fanout, headers
        }
      ],
      
      // Queue bindings (optional) - connect queue to exchange
      queueBindings: [
        { 
          exchange: 'my-exchange',      // Which exchange to bind to
          routingKey: 'test.*'          // Routing pattern for messages
        }
      ]
    }, 
    // Message handler function - this runs for each incoming message
    async (msg) => {
      console.log('📥 Received message:', JSON.stringify(msg, null, 2));
      
      // MESSAGE PROCESSING
      // Do your business logic here - this could be:
      // - Saving to database
      // - Calling an API
      // - Processing data
      // - Sending an email
      // etc.
      
      try {
        // Simulate some processing work (e.g., saving to DB, calling API)
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate 1 second processing
        
        // LOGIC BASED ON MESSAGE CONTENT
        if (msg.type === 'email') {
          console.log('📧 Processing email message...');
          // Send email logic here
        } else if (msg.type === 'notification') {
          console.log('🔔 Processing notification message...');
          // Send notification logic here
        } else {
          console.log('📄 Processing regular message...');
          // Default processing logic
        }
        
        console.log('✅ Message processed successfully!');
        
        // AUTO-ACKNOWLEDGMENT:
        // - If this function completes without throwing an error:
        //   ✅ Message is automatically acknowledged (acked)
        //   ✅ Message is removed from queue
        // 
        // - If this function throws an error:
        //   ❌ Message is rejected (nacked)
        //   ❌ Message may be requeued or sent to dead letter queue
        // 
        // - You don't need to manually call ack() - it's handled automatically!
        
      } catch (error) {
        console.error('❌ Error processing message:', error);
        
        // When an error is thrown, the message will be rejected and may be:
        // - Requeued for another attempt
        // - Moved to a dead letter queue (if configured)
        // - Dropped (if no retry mechanism is configured)
        throw error; // This tells the library to nacmessage
      }
    });

    // Listen for consumer events
    consumer.on('error', (err) => {
      console.error('❌ Consumer error:', err);
    });

    console.log('\n👂 Consumer is now listening for messages...');
    console.log('Send messages to "my-test-queue" or to "my-exchange" with routing key "test.*"');
    console.log('The consumer will automatically process any incoming messages.\n');

    // 3. CREATE A PUBLISHER TO TEST THE CONSUMER
    const publisher = await rabbit.createPublisher({
      confirm: true,        // Wait for confirmation that message was received by broker
      maxAttempts: 2        // Retry publishing up to 2 times if it fails
    });

    // 4. SEND TEST MESSAGES
    console.log('Sending test messages...\n');

    // Send a direct message to the queue
    await publisher.send('my-test-queue', {
      id: 1,
      type: 'notification',
      message: 'Hello from test message 1!',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Sent direct message to queue');

    // Send a message to the exchange (it will be routed to the queue based on binding)
    await publisher.send(
      { exchange: 'my-exchange', routingKey: 'test.message' },
      {
        id: 2,
        type: 'email',
        subject: 'Test Email',
        body: 'Hello from test message 2!',
        timestamp: new Date().toISOString()
      }
    );
    console.log('✅ Sent message to exchange (will go to queue based on routing key)');

    // 5. KEEP THE EXAMPLE RUNNING TO SEE MESSAGE PROCESSING
    console.log('\nWaiting for messages to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    // 6. CLEANUP
    console.log('\n--- Cleaning up ---');
    
    // Close the consumer
    await consumer.close();
    console.log('✅ Consumer closed');
    
    // Close the publisher
    await publisher.close();
    console.log('✅ Publisher closed');
    
    // Close the connection
    await rabbit.close();
    console.log('✅ Connection closed');
    
  } catch (error) {
    console.error('❌ Error in example:', error);
    
    // Make sure to clean up in case of error
    try {
      await rabbit.close();
    } catch (closeError) {
      console.error('❌ Error closing connection:', closeError);
    }
  }
}

// Run the example
simpleConsumerExample().catch(console.error);