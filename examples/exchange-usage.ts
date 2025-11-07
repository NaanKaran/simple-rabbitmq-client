import { QueueManager, RabbitMQConsumer, RabbitMQProducer, RabbitMqConfig } from '../src/index';

const config: RabbitMqConfig = {
  url: 'amqp://localhost', // Replace with your RabbitMQ server URL
  maxRetries: 3,
  retryDelay: 5000,
  heartbeat: 30
};

async function exchangeExample() {
  console.log('🔄 Starting exchange usage example...');
  
  const queueManager = new QueueManager(config);
  const consumer = new RabbitMQConsumer(queueManager);
  const producer = new RabbitMQProducer(queueManager);

  // Declare different queue names for different routing keys
  const directQueue = 'direct-example-queue';
  const topicQueue = 'topic-example-queue';
  const fanoutQueue = 'fanout-example-queue';

  // Set up consumers for each queue type
  await consumer.consume(
    directQueue,
    async (msg, ack) => {
      console.log(`(DIRECT) Received: ${msg.content.toString()}`);
      ack();
    }
  );

  await consumer.consume(
    topicQueue,
    async (msg, ack) => {
      console.log(`(TOPIC)  Received: ${msg.content.toString()}`);
      ack();
    }
  );

  await consumer.consume(
    fanoutQueue,
    async (msg, ack) => {
      console.log(`(FANOUT) Received: ${msg.content.toString()}`);
      ack();
    }
  );

  console.log('👂 Consumers are listening for exchange messages...');

  // Send messages to different exchange types
  
  // Direct exchange example
  try {
    await producer.sendToExchange('amq.direct', 'error', { type: 'error', message: 'This is an error message' });
    await producer.sendToExchange('amq.direct', 'info', { type: 'info', message: 'This is an info message' });
    console.log('✅ Sent messages to direct exchange');
  } catch (error) {
    console.log('⚠️ Direct exchange may not be available in your RabbitMQ setup, skipping...');
  }

  // Topic exchange example
  try {
    await producer.sendToExchange('amq.topic', 'user.signup', { 
      event: 'user.signup', 
      userId: 123,
      timestamp: new Date().toISOString()
    });
    
    await producer.sendToExchange('amq.topic', 'user.login', { 
      event: 'user.login', 
      userId: 456,
      timestamp: new Date().toISOString()
    });
    
    await producer.sendToExchange('amq.topic', 'system.status', { 
      event: 'system.status', 
      status: 'operational',
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Sent messages to topic exchange');
  } catch (error) {
    console.log('⚠️ Topic exchange may not be available in your RabbitMQ setup, skipping...');
  }

  // Fanout exchange example
  try {
    await producer.sendToExchange('amq.fanout', '', { 
      message: 'Broadcast message to all queues',
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Sent message to fanout exchange');
  } catch (error) {
    console.log('⚠️ Fanout exchange may not be available in your RabbitMQ setup, skipping...');
  }

  // Send a few more test messages to see routing in action
  try {
    await producer.sendToExchange('amq.topic', 'user.logout', {
      event: 'user.logout',
      userId: 789,
      timestamp: new Date().toISOString()
    });
    console.log('✅ Sent additional topic exchange message');
  } catch (error) {
    console.log('⚠️ Topic exchange may not be available in your RabbitMQ setup, skipping...');
  }

  // Wait for all messages to be processed
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Clean up
  await queueManager.closeAll();
  console.log('✅ Exchange example completed');
}

// Run the example
exchangeExample().catch(console.error);