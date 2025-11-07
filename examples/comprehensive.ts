/**
 * Comprehensive Example: Simple RabbitMQ Client Usage
 * 
 * This example demonstrates all the main features of the rabbitmq-connect-helper library:
 * - Basic producer/consumer setup
 * - Advanced configuration options
 * - Error handling and retry mechanisms
 * - Exchange usage
 * - Connection management
 */

import { 
  QueueManager, 
  RabbitMQConsumer, 
  RabbitMQProducer, 
  RabbitMqConfig, 
  ConsumerOptions, 
  ProducerOptions 
} from '../src/index';

async function runComprehensiveExample() {
  console.log('🌟 Running Comprehensive RabbitMQ Client Example');
  console.log('================================================');

  // 1. CONFIGURATION SETUP
  console.log('\n1. 🛠️  Setting up configuration...');
  
  const config: RabbitMqConfig = {
    url: 'amqp://localhost', // Replace with your RabbitMQ server
    maxRetries: 3,
    retryDelay: 5000,
    heartbeat: 30,
    connectionTimeout: 10000,
    authentication: {
      username: 'guest',  // Update with your credentials
      password: 'guest'
    }
  };

  // 2. INITIALIZATION
  console.log('\n2. 🚀 Initializing QueueManager, Consumer, and Producer...');
  
  const queueManager = new QueueManager(config);
  const consumer = new RabbitMQConsumer(queueManager);
  const producer = new RabbitMQProducer(queueManager);

  // 3. ADVANCED CONSUMER SETUP
  console.log('\n3. 👂 Setting up consumer with advanced options...');
  
  const consumerOptions: ConsumerOptions = {
    prefetch: 3,
    retryAttempts: 2,
    retryDelayMs: 2000,
    deadLetterQueueSuffix: '.DLQ',
    processingTimeout: 10000,
    errorHandler: (error, queueName, msg) => {
      console.error(`🚨 Error in ${queueName}:`, error.message);
    }
  };

  // Define queues for different purposes
  const basicQueue = 'comprehensive-basic-queue';
  const errorQueue = 'comprehensive-error-queue';

  // Set up basic consumer
  await consumer.consume(
    basicQueue,
    async (msg, ack, retry) => {
      try {
        const content = JSON.parse(msg.content.toString());
        console.log(`✅ Processed basic message:`, content);

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        ack(); // Acknowledge successful processing
      } catch (error) {
        console.error('❌ Basic consumer error:', error);
        await retry(); // Retry the message
      }
    },
    consumerOptions
  );

  // Set up error handling consumer
  await consumer.consume(
    errorQueue,
    async (msg, ack, retry) => {
      try {
        const content = msg.content.toString();
        console.log(`📥 Processing error-prone message: ${content}`);

        // Simulate a condition that might fail
        if (content.includes('fail')) {
          throw new Error('Simulated processing failure');
        }

        console.log(`✅ Successfully processed: ${content}`);
        ack();
      } catch (error) {
        console.error(`❌ Error processing:`, error);
        await retry(); // Retry on failure
      }
    },
    consumerOptions
  );

  console.log('✅ Consumers are now listening...');

  // 4. PRODUCER OPTIONS
  console.log('\n4. 📤 Setting up producer with options...');
  
  const producerOptions: ProducerOptions = {
    persistent: true,
    contentType: 'application/json',
    correlationId: 'comprehensive-example',
    expiration: 60000, // Expires after 1 minute
    headers: {
      'source': 'comprehensive-example',
      'timestamp': new Date().toISOString()
    }
  };

  // 5. SENDING MESSAGES
  console.log('\n5. 📨 Sending various types of messages...');

  // Send basic messages
  for (let i = 1; i <= 3; i++) {
    await producer.send(basicQueue, {
      id: i,
      type: 'basic',
      message: `Basic message #${i}`,
      timestamp: new Date().toISOString()
    }, producerOptions);
    
    console.log(`✅ Sent basic message #${i}`);
  }

  // Send messages that might fail
  await producer.send(errorQueue, 'This message will succeed');
  await producer.send(errorQueue, 'This message will fail'); // This will trigger retry logic
  await producer.send(errorQueue, 'This message will succeed too');

  // 6. EXCHANGE USAGE
  console.log('\n6. 🔄 Sending messages to exchanges...');

  try {
    await producer.sendToExchange('amq.topic', 'comprehensive.test', {
      type: 'exchange-message',
      content: 'Message sent to topic exchange',
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Sent message to topic exchange');
  } catch (error) {
    console.log('⚠️ Topic exchange may not be available, skipping...');
  }

  // 7. MONITORING
  console.log('\n7. 📊 Monitoring connection status...');
  
  const status = queueManager.getConnectionStatus();
  console.log('Connection Status:', {
    totalConnections: status.totalConnections,
    activeQueues: status.activeQueues
  });

  // Wait for messages to be processed
  await new Promise(resolve => setTimeout(resolve, 8000));

  console.log('\n8. 📈 Consumer Metrics:', consumer.getMetrics());

  // 9. CLEANUP
  console.log('\n9. 🧹 Cleaning up resources...');
  
  await queueManager.closeAll();
  console.log('\n🎉 Comprehensive example completed successfully!');

  console.log('\n💡 Key features demonstrated:');
  console.log('   • Advanced configuration with all options');
  console.log('   • Consumer with error handling and retries');
  console.log('   • Producer with message options');
  console.log('   • Exchange usage');
  console.log('   • Connection management and monitoring');
  console.log('   • Dead Letter Queue functionality');
}

// Run the comprehensive example
runComprehensiveExample().catch(console.error);