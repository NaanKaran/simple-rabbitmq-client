import { QueueManager, RabbitMQConsumer, RabbitMQProducer, RabbitMqConfig, ConsumerOptions } from '../src/index';

const config: RabbitMqConfig = {
  url: 'amqp://localhost', // Replace with your RabbitMQ server URL
  maxRetries: 3,
  retryDelay: 2000,
  heartbeat: 30
};

async function errorHandlingExample() {
  console.log('🚨 Starting error handling and retry example...');
  
  const queueManager = new QueueManager(config);
  const consumer = new RabbitMQConsumer(queueManager);
  const producer = new RabbitMQProducer(queueManager);

  const queueName = 'error-handling-queue';
  const dlqName = `${queueName}.DLQ`; // Dead Letter Queue name

  // Consumer options with comprehensive error handling
  const consumerOptions: ConsumerOptions = {
    prefetch: 1,                // Process one message at a time for clear error demonstration
    retryAttempts: 2,           // Retry failed messages 2 times before DLQ
    retryDelayMs: 1000,         // 1 second between retries
    deadLetterQueueSuffix: '.DLQ',
    processingTimeout: 5000,    // Timeout if processing takes longer than 5 seconds
    errorHandler: (error, queueName, msg) => {
      console.error(`🚨 Custom error handler for queue ${queueName}:`, error.message);
      if (msg) {
        console.log(`📄 Message content that failed: ${msg.content.toString()}`);
      }
    }
  };

  // Set up consumer with error handling
  await consumer.consume(
    queueName,
    async (msg, ack, retry) => {
      const content = msg.content.toString();
      console.log(`📥 Processing message: ${content}`);

      // Simulate message processing that might fail
      try {
        // Simulate different processing behaviors based on content
        if (content.includes('fail')) {
          throw new Error(`Simulated failure processing: ${content}`);
        }
        
        if (content.includes('timeout')) {
          // Simulate timeout by waiting longer than the timeout setting
          await new Promise(resolve => setTimeout(resolve, 6000));
        }

        console.log(`✅ Successfully processed message: ${content}`);
        ack(); // Acknowledge successful processing
      } catch (error) {
        console.error(`❌ Error processing message:`, error);
        await retry(); // Retry the message
      }
    },
    consumerOptions
  );

  console.log('👂 Consumer is listening with error handling...');

  // Send messages that will succeed
  await producer.send(queueName, 'This message will succeed');
  console.log('✅ Sent successful message');

  // Send messages that will fail and be retried
  await producer.send(queueName, 'This message will fail');
  console.log('⚠️ Sent failing message (will retry)');

  // Send a message that will timeout
  await producer.send(queueName, 'This message will timeout');
  console.log(' ⏰ Sent timeout message');

  // Wait for all processing to complete
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('📊 Consumer metrics:', consumer.getMetrics());

  // Clean up
  await queueManager.closeAll();
  console.log('✅ Error handling example completed');
}

// Run the example
errorHandlingExample().catch(console.error);