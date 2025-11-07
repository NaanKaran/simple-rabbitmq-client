import { Connection } from './src/index';

async function testConnection() {
  console.log('Testing the simplified Connection API...');
  
  try {
    // Initialize:
    const rabbit = new Connection('amqp://guest:guest@localhost:5672');
    
    rabbit.on('error', (err) => {
      console.log('RabbitMQ connection error', err);
    });
    
    rabbit.on('connection', () => {
      console.log('✅ Connection successfully (re)established');
    });

    // Consume messages from a queue:
    const stop = await rabbit.createConsumer({
      queue: 'simple-test-queue',
      handler: async (msg, ack, retry) => {
        console.log('📥 Received:', msg.content.toString());
        ack(); // acknowledge the message
      },
      prefetch: 1,
      retryAttempts: 3,
      retryDelayMs: 5000
    });

    console.log('👂 Consumer is listening...');

    // Send a message:
    const send = await rabbit.createProducer({ queue: 'simple-test-queue' });
    const success = await send({ 
      hello: 'world', 
      timestamp: new Date().toISOString(),
      test: 'message'
    });
    
    if (success) {
      console.log('✅ Message sent successfully!');
    } else {
      console.log('❌ Message was dropped');
    }

    // Publish to exchange:
    await rabbit.sendToExchange('amq.topic', 'simple.test', { 
      message: 'Hello from exchange', 
      timestamp: new Date().toISOString() 
    });
    console.log('✅ Message sent to exchange');

    // Queue and exchange declarations:
    await rabbit.queueDeclare('simple-test-queue', { durable: true });
    console.log('✅ Queue declared');
    
    await rabbit.exchangeDeclare('simple-test-exchange', 'topic', { durable: true });
    console.log('✅ Exchange declared');
    
    await rabbit.queueBind('simple-test-queue', 'simple-test-exchange', 'simple.*');
    console.log('✅ Queue bound to exchange');

    // Let it run for a while to process messages
    console.log('Waiting for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Close connection when done:
    await rabbit.close();
    console.log('🔌 Connection closed');
  } catch (error) {
    console.error('Error in test:', error);
  }
}

testConnection().catch(console.error);