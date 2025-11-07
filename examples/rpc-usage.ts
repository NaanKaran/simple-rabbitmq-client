import { 
  QueueManager, 
  RabbitMQRPCClient, 
  RabbitMQRPCServer, 
  RabbitMqConfig 
} from '../src/index';

async function rpcExample() {
  console.log('🔄 Starting RPC (Request-Response) Communication Example');
  console.log('=====================================================');

  // Configuration
  const config: RabbitMqConfig = {
    url: 'amqp://localhost', // Replace with your RabbitMQ server
    maxRetries: 3,
    retryDelay: 5000,
    heartbeat: 30
  };

  const queueManager = new QueueManager(config);

  console.log('\n1. 🏗️ Starting RPC Server...');
  
  // Create and start RPC server
  const rpcServer = new RabbitMQRPCServer(queueManager);
  
  // Define the RPC queue name
  const rpcQueueName = 'rpc-example-queue';
  
  // Set up the server to handle requests
  await rpcServer.listen(rpcQueueName, async (request, reply) => {
    console.log(`📥 RPC Server received request:`, request);
    
    try {
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Process the request and send response
      const response = {
        originalRequest: request,
        processed: true,
        timestamp: new Date().toISOString(),
        result: `Processed: ${JSON.stringify(request)}`
      };
      
      console.log(`📤 RPC Server sending response:`, response);
      await reply(response);
    } catch (error) {
      console.error('❌ Error processing RPC request:', error);
      await reply({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  console.log(`✅ RPC Server is listening on queue: ${rpcQueueName}`);

  // Wait a bit to ensure server is ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n2. 🏗️ Creating RPC Client...');
  
  // Create and initialize RPC client
  const rpcClient = new RabbitMQRPCClient(queueManager, new RabbitMQProducer(queueManager));
  await rpcClient.init();
  
  console.log('✅ RPC Client initialized');

  console.log('\n3. 📤 Sending RPC requests...');

  // Send several RPC requests
  const requests = [
    { operation: 'add', a: 5, b: 3 },
    { operation: 'multiply', a: 4, b: 7 },
    { operation: 'greet', name: 'World' }
  ];

  for (const request of requests) {
    try {
      console.log(`\nSending request:`, request);
      const response = await rpcClient.send(rpcQueueName, request);
      console.log(`Received response:`, response.body);
    } catch (error) {
      console.error('❌ Error sending RPC request:', error);
    }
  }

  console.log('\n4. ⏱️ Testing RPC timeout...');

  // Test timeout scenario by setting a very short timeout
  try {
    const timeoutClient = new RabbitMQRPCClient(queueManager, new RabbitMQProducer(queueManager), { timeout: 100 }); // 100ms timeout
    await timeoutClient.init();
    
    console.log('Sending request with 100ms timeout (should timeout)...');
    await timeoutClient.send(rpcQueueName, { operation: 'delayed', delay: 500 });
  } catch (error) {
    console.log(`✅ Timeout handled correctly:`, error.message);
  }

  console.log('\n✅ RPC example completed successfully!');

  // Clean up
  await rpcClient.close();
  await queueManager.closeAll();
  console.log('🧹 Resources cleaned up');
}

// We need to import RabbitMQProducer here since it's used in the example
import { RabbitMQProducer } from '../src/index';

// Run the example
rpcExample().catch(console.error);