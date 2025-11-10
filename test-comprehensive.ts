import { Connection, SimpleProducer, EnhancedProducer } from "./src/index";

async function testUserCode() {
  // This is the exact code from the user that should now work
  const rabbit = new Connection(
    "amqps://ubyzlkay:nty1PNYyOHlLyaulk51cEfgJ5pKIxCiv@fly.rmq.cloudamqp.com:5671/ubyzlkay"
  );
  rabbit.on("error", (err) => {
    console.log("RabbitMQ connection error", err);
  });
  rabbit.on("connection", () => {
    console.log("Connection successfully (re)established");
  });

  // Test both usage patterns that should work now:
  
  // 1. EnhancedProducer pattern (when options object with queue is passed to createProducer)
  console.log("Testing EnhancedProducer pattern...");
  const publisher1: EnhancedProducer = await rabbit.createProducer({ 
    queue: "my-queue",
    queueOptions: { durable: true }
  });
  for (let i = 0; i < 5; i++) {
    try {
      const success = await publisher1.send({ hello: `world ${i}` });
      console.log(`EnhancedProducer - Message ${i} sent successfully: ${success}`);
    } catch (error) {
      console.error(`EnhancedProducer - Error sending message ${i}:`, error);
    }
  }

  // 2. SimpleProducer pattern (when just queue name is passed to createProducer)
  console.log("Testing SimpleProducer pattern...");
  const publisher2: SimpleProducer = await rabbit.createProducer("my-queue-2");
  for (let i = 0; i < 5; i++) {
    try {
      const success = await publisher2.send({ hello: `world ${i}` });
      console.log(`SimpleProducer - Message ${i} sent successfully: ${success}`);
    } catch (error) {
      console.error(`SimpleProducer - Error sending message ${i}:`, error);
    }
  }

  // 3. Original user pattern should work too
  console.log("Testing original user pattern...");
  const publisher = await rabbit.createProducer({ queue: "my-queue" });
  for (let i = 0; i < 100; i++) {
    try {
      const success = await publisher.send({ hello: `world ${i}` });
      console.log(`User pattern - Message ${i} sent successfully: ${success}`);
    } catch (error) {
      console.error(`User pattern - Error sending message ${i}:`, error);
    }
  }

  console.log("All patterns validated successfully!");
  await rabbit.close();
}

testUserCode().catch(console.error);