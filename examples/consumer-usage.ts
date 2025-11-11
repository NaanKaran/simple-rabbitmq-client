import { Connection } from '../src/index';

/**
 * Comprehensive Example: RabbitMQ Message Consumption
 * 
 * This example demonstrates how to properly consume messages using the enhanced API.
 * It covers:
 * - Basic consumer setup
 * - Quality of Service (QoS) settings
 * - Exchange declarations and bindings
 * - Message handling with proper error handling
 * - Event handling for consumers
 * - Proper cleanup and shutdown
 */

async function consumerExample() {
  console.log('🚀 Starting Consumer Example...\n');

  // Initialize connection with proper configuration
  const rabbit = new Connection('amqp://guest:guest@localhost:5672', {
    maxRetries: 3,        // Maximum number of reconnection attempts
    retryDelay: 5000,     // Delay in ms between reconnection attempts
    heartbeat: 30         // Heartbeat interval in seconds
  });

  // Event handlers for connection events
  rabbit.on('error', (err) => {
    console.error('❌ RabbitMQ connection error:', err);
  });

  rabbit.on('connection', () => {
    console.log('✅ Connection successfully (re)established');
  });

  rabbit.on('close', (info) => {
    console.log('🔌 Connection closed:', info);
  });

  try {
    // Example 1: Basic Consumer
    console.log('\n--- Example 1: Basic Consumer ---');
    const basicConsumer = await rabbit.createConsumer({
      queue: 'basic-messages',     // Queue name to consume from
      queueOptions: { 
        durable: true             // Makes queue survive server restarts
      },
      qos: { 
        prefetchCount: 1          // Process one message at a time
      }
    }, async (msg) => {
      console.log('📥 Received basic message:', msg);
      
      // Process the message (simulate some work)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Message is automatically acknowledged when this function completes
      // If this function throws an error, the message will be rejected and possibly requeued
      console.log('✅ Basic message processed successfully');
    });

    // Event handlers for the consumer
    basicConsumer.on('error', (err) => {
      console.error('❌ Error in basic consumer:', err);
    });

    // Example 2: Advanced Consumer with Exchange and Bindings
    console.log('\n--- Example 2: Advanced Consumer with Exchange ---');
    const advancedConsumer = await rabbit.createConsumer({
      queue: 'user-events',              // Queue name
      queueOptions: { 
        durable: true                    // Queue survives server restarts
      },
      qos: { 
        prefetchCount: 2                // Process up to 2 messages concurrently
      },
      exchanges: [                       // Declare exchanges if they don't exist
        { 
          exchange: 'user-activity',     // Exchange name
          type: 'topic',                // Exchange type (direct, topic, fanout, headers)
          durable: true                 // Exchange survives server restarts
        }
      ],
      queueBindings: [                   // Bind queue to exchange with routing pattern
        { 
          exchange: 'user-activity',     // Which exchange to bind to
          routingKey: 'users.*'          // Pattern for routing messages to this queue
        }
      ]
    }, async (msg) => {
      console.log('📥 Received user event:', msg);
      
      // Process the message with potential for different outcomes
      try {
        // Simulate message processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Example logic based on message content
        if (msg.action === 'delete') {
          console.log('⚠️ Processing delete action - extra care needed');
          // Perform delete action
        } else {
          console.log('✅ Processing regular action');
          // Perform regular action
        }
        
        console.log('✅ User event processed successfully');
        
        // Returning nothing or void means message will be acknowledged (acked)
        // You can also return 0 to explicitly nack (reject) the message
        // Or return any other value to ack the message
        return; // This is equivalent to acknowledging the message
        
      } catch (error) {
        console.error('❌ Error processing user event:', error);
        // Throwing an error will cause the message to be rejected (nacked)
        // and potentially requeued or sent to a dead-letter exchange
        throw error;
      }
    });

    advancedConsumer.on('error', (err) => {
      console.error('❌ Error in advanced consumer:', err);
    });

    // Example 3: Consumer with Error Handling and Custom Logic
    console.log('\n--- Example 3: Consumer with Detailed Error Handling ---');
    const errorHandlingConsumer = await rabbit.createConsumer({
      queue: 'error-prone-messages',
      queueOptions: { 
        durable: true 
      },
      qos: { 
        prefetchCount: 1 
      },
      exchanges: [
        { 
          exchange: 'system-events', 
          type: 'direct',
          durable: true 
        }
      ],
      queueBindings: [
        { 
          exchange: 'system-events', 
          routingKey: 'critical.errors' 
        }
      ]
    }, async (msg) => {
      console.log('📥 Received critical message:', msg);
      
      try {
        // Simulate processing that might fail
        await new Promise((resolve, reject) => {
          // Simulate 30% chance of failure for demonstration
          if (Math.random() < 0.3) {
            reject(new Error('Simulated processing failure'));
          } else {
            resolve('Success');
          }
        });
        
        console.log('✅ Critical message processed successfully');
        
      } catch (error) {
        console.error('❌ Critical message processing failed:', error);
        // The library will handle retry logic based on the consumer configuration
        // Messages will be retried and eventually moved to DLQ if they keep failing
        throw error; // Re-throw to trigger nack/ret
      }
    });

    errorHandlingConsumer.on('error', (err) => {
      console.error('❌ Error in error-handling consumer:', err);
    });

    console.log('\n--- Consumers are now listening for messages... ---');
    console.log('Messages will be consumed according to the configurations above.');
    console.log('Press Ctrl+C to stop the example.\n');

    // Simulate sending some messages for testing
    const publisher = await rabbit.createPublisher({
      confirm: true,
      maxAttempts: 2
    });

    // Send a test message to the basic queue
    await publisher.send('basic-messages', {
      id: 1,
      content: 'This is a basic test message',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Test message sent to basic-messages queue');

    // Send a test message to the exchange that routes to user-events queue
    await publisher.send(
      { exchange: 'user-activity', routingKey: 'users.login' },
      {
        id: 2,
        userId: 'user123',
        action: 'login',
        timestamp: new Date().toISOString()
      }
    );
    console.log('✅ Test message sent to user-activity exchange');

    // Send another message with different routing key
    await publisher.send(
      { exchange: 'user-activity', routingKey: 'users.logout' },
      {
        id: 3,
        userId: 'user456',
        action: 'logout',
        timestamp: new Date().toISOString()
      }
    );
    console.log('✅ Test message sent to user-activity exchange');

    // Keep the example running for a while to see message processing
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Example 4: Consumer with Manual Acknowledgment Control
    console.log('\n--- Example 4: Consumer with Manual Ack/Nack Control ---');
    
    // For more granular control, you could use the lower-level API
    // but the enhanced API handles this automatically based on your function's return value
    console.log('Note: The enhanced API handles acknowledgment automatically:');
    console.log('- If your handler function completes without throwing: message is acknowledged (acked)');
    console.log('- If your handler function throws an error: message is rejected (nacked)');
    console.log('- You can return 0 from the handler to explicitly reject the message');
    console.log('- You can return any other value to acknowledge the message');

    // Proper shutdown sequence
    console.log('\n--- Initiating Shutdown Sequence ---');
    
    // Close all consumers and publishers before closing the connection
    await basicConsumer.close();
    console.log('✅ Basic consumer closed');
    
    await advancedConsumer.close();
    console.log('✅ Advanced consumer closed');
    
    await errorHandlingConsumer.close();
    console.log('✅ Error-handling consumer closed');
    
    await publisher.close();
    console.log('✅ Publisher closed');
    
    await rabbit.close();
    console.log('✅ RabbitMQ connection closed');
    
  } catch (error) {
    console.error('❌ Error in consumer example:', error);
    
    // Ensure cleanup even if there's an error
    try {
      await rabbit.close();
      console.log('🔌 Connection closed due to error');
    } catch (closeError) {
      console.error('❌ Error closing connection:', closeError);
    }
  }
}

/**
 * Utility function to handle graceful shutdown
 */
function setupGracefulShutdown(rabbitConnection: Connection) {
  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('\n⚠️  Received shutdown signal...');
    try {
      await rabbitConnection.close();
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    shutdown();
  });
}

// Run the example
consumerExample().catch(console.error);

// Setup graceful shutdown
// Note: In a real application, you would pass the actual connection instance
// For this example, we can't access it directly here, so it's handled in the main function