import { Connection } from "./src/index";

async function testUpdatedAPI() {
  // Initialize:
  const rabbit = new Connection(
    "amqps://ubyzlkay:nty1PNYyOHlLyaulk51cEfgJ5pKIxCiv@fly.rmq.cloudamqp.com:5671/ubyzlkay"
  );
  rabbit.on("error", (err) => {
    console.log("RabbitMQ connection error", err);
  });
  rabbit.on("connection", () => {
    console.log("Connection successfully (re)established");
  });

  try {
    // Send a message using the updated API:
    const publisher = await rabbit.createProducer({ queue: "my-queue" });
    for (let i = 0; i < 100; i++) {
      const success = await publisher.send({ hello: `world ${i}` });
      console.log(`Message ${i} sent successfully: ${success}`);
    }
    
    console.log("All messages sent successfully!");
  } catch (error) {
    console.error("Error during message sending:", error);
  } finally {
    await rabbit.close();
  }
}

testUpdatedAPI().catch(console.error);