import { QueueManager, RabbitMQConsumer, RabbitMQProducer, RabbitMqConfig, ConsumerOptions, ProducerOptions } from '../src/index';

// Example configuration with advanced settings
const config: RabbitMqConfig = {
  url: 'amqp://localhost', // Replace with your RabbitMQ server URL
  options: {
    // Additional amqplib connection options can go here
  },
  connectionTimeout: 10000,  // 10 seconds to connect
  maxRetries: 5,             // Try to reconnect up to 5 times
  retryDelay: 10000,         // Wait 10 seconds between reconnection attempts
  heartbeat: 30,             // 30 second heartbeat interval
  tls: {
    enabled: false,          // Enable this if using SSL/TLS
    // certPath: '/path/to/cert.pem',
    // keyPath: '/path/to/key.pem', 
    // caPath: '/path/to/ca.pem',
    // passphrase: 'your-passphrase'
  },
  authentication: {
    username: 'guest',       // Replace with your username
    password: 'guest'        // Replace with your password
  }
};

async function advancedExample() {
  console.log('🚀 Starting advanced RabbitMQ example...');
  
  // Initialize the QueueManager with advanced configuration
  const queueManager = new QueueManager(config);
  
  // Create consumer and producer instances
  const consumer = new RabbitMQConsumer(queueManager);
  const producer = new RabbitMQProducer(queueManager);

  // Define queue name
  const queueName = 'advanced-example-queue';

  // Advanced consumer options
  const consumerOptions: ConsumerOptions = {
    prefetch: 5,                           // Process up to 5 messages concurrently
    retryAttempts: 3,                      // Retry failed messages up to 3 times
    retryDelayMs: 3000,                    // Wait 3 seconds between retries
    deadLetterQueueSuffix: '.DLQ',         // Send to DLQ after retries exhausted
    processingTimeout: 10000,              // Timeout message processing after 10 seconds
    errorHandler: (error, queueName, msg) => {
      console.error(`🚨 Error in ${queueName}:`, error.message);
      // Custom error handling logic here
    }
  };

  // Set up a consumer with advanced options
  await consumer.consume(
    queueName,
    async (msg, ack, retry) => {
      try {
        const content = msg.content.toString();
        console.log(`✅ Received message: ${content}`);
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Acknowledge successful processing
        ack();
      } catch (error) {
        console.error('❌ Error processing message:', error);
        await retry(); // Retry the message
      }
    },
    consumerOptions
  );

  console.log('👂 Consumer is now listening for messages with advanced options...');

  // Advanced producer options
  const producerOptions: ProducerOptions = {
    persistent: true,                    // Make message persistent (survives broker restart)
    contentType: 'application/json',     // Set content type
    correlationId: 'message-correlation-id', // Set correlation ID for RPC
    replyTo: 'reply-queue-name',         // Set reply-to queue
    expiration: 60000,                   // Message expires after 1 minute
    headers: {                          // Custom headers
      'custom-header': 'custom-value',
      'timestamp': new Date().toISOString()
    }
  };

  // Send a complex message with options
  const complexMessage = {
    id: Date.now(),
    type: 'example-message',
    timestamp: new Date().toISOString(),
    data: {
      title: 'Advanced Example',
      content: 'This is a complex message with options',
      userId: 12345
    }
  };

  const success = await producer.send(queueName, complexMessage, producerOptions);
  
  if (success) {
    console.log('✅ Sent complex message with options');
  } else {
    console.log('❌ Failed to send complex message');
  }

  // Also show how to send to an exchange
  try {
    await producer.sendToExchange('amq.topic', 'example.routing.key', {
      type: 'exchange-message',
      content: 'This message was sent to an exchange'
    });
    console.log('✅ Sent message to exchange');
  } catch (error) {
    console.error('❌ Failed to send message to exchange:', error);
  }

  // Wait for messages to be processed
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Show connection status
  const status = queueManager.getConnectionStatus();
  console.log('📊 Connection status:', status);

  // Clean up
  await queueManager.closeAll();
  console.log('✅ Advanced example completed');
}

// Run the example
advancedExample().catch(console.error);