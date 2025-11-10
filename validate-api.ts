import { Connection, SimpleProducer } from "./src/index";

async function validateAPI() {
  // Test the new API
  const rabbit = new Connection("amqp://localhost");
  
  // Test createProducer with options
  const producerWithOptions: SimpleProducer = await rabbit.createProducer({ queue: "test-queue" });
  const success1: boolean = await producerWithOptions.send({ test: "message" });
  
  // Test createProducer with queue name
  const producerWithName: SimpleProducer = await rabbit.createProducer("test-queue-2");
  const success2: boolean = await producerWithName.send({ test: "message2" });
  
  // Test createProducer with queue name and options
  const producerWithQueueAndOptions: SimpleProducer = await rabbit.createProducer("test-queue-3", { queueOptions: { durable: true } });
  const success3: boolean = await producerWithQueueAndOptions.send({ test: "message3" });
  
  console.log("All API calls validated successfully!");
  
  await rabbit.close();
}

validateAPI().catch(console.error);