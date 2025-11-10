import { Connection } from "./src/index";

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

async function testProducer() {
  // Send a message:
  const publisher = await rabbit.createProducer({ queue: "my-queue" });
  
  for (let i = 0; i < 5; i++) {
    // This should now work with the .send() method
    const success = await publisher.send({ hello: `world ${i}` });
    console.log(`Message ${i} sent: ${success}`);
  }

  // Clean up
  await rabbit.close();
}

testProducer().catch(console.error);