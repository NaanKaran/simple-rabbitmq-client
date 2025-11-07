import { QueueManager, RabbitMQConsumer, RabbitMQProducer, RabbitMqConfig } from '../src/index';

// Example configuration with basic settings
const config: RabbitMqConfig = {
  url: 'amqp://localhost', // Replace with your RabbitMQ server URL
  maxRetries: 3,
  retryDelay: 5000,
  heartbeat: 30
};

async function basicExample() {
  console.log('🚀 Starting basic RabbitMQ example...');
  
  // Initialize the QueueManager
  const queueManager = new QueueManager(config);
  
  // Create consumer and producer instances
  const consumer = new RabbitMQConsumer(queueManager);
  const producer = new RabbitMQProducer(queueManager);

  // Define queue name
  const queueName = 'basic-example-queue';

  // Set up a consumer to receive messages
  await consumer.consume(
    queueName,
    async (msg, ack, retry) => {
      try {
        const content = msg.content.toString();
        console.log(`✅ Received message: ${content}`);
        
        // Simulate processing the message
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Acknowledge successful processing
        ack();
      } catch (error) {
        console.error('❌ Error processing message:', error);
        await retry(); // Retry the message
      }
    },
    {
      prefetch: 2,           // Process up to 2 messages concurrently
      retryAttempts: 3,      // Retry failed messages up to 3 times
      retryDelayMs: 5000,    // Wait 5 seconds between retries
      deadLetterQueueSuffix: '.DLQ'  // Send to DLQ after retries exhausted
    }
  );

  console.log('👂 Consumer is now listening for messages...');

  // Send some messages
  for (let i = 1; i <= 3; i++) {
    const message = `Hello World ${i}!`;
    const success = await producer.send(queueName, message);
    
    if (success) {
      console.log(`✅ Sent message: ${message}`);
    } else {
      console.log(`❌ Failed to send message: ${message}`);
    }
    
    // Wait a bit between messages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Let messages be processed
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Clean up
  await queueManager.closeAll();
  console.log('✅ Basic example completed');
}

// Run the example
basicExample().catch(console.error);