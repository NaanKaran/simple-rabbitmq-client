// For Node.js CommonJS - using local build
const { Connection } = require("./dist");

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

// Send a message:
async function sendMessage() {
  const publisher = await rabbit.createPublisher({ 
    // Add any publisher options if needed
  });
  const success = await publisher.send("my-queue", { hello: "world" });
  console.log("Message sent:", success);

  // Publish to exchange:
  await rabbit.sendToExchange("my-exchange", "routing.key", { hello: "world" });

  // Queue and exchange declarations:
  await rabbit.queueDeclare("my-queue", { durable: true });
  await rabbit.exchangeDeclare("my-exchange", "topic", { durable: true });
  await rabbit.queueBind("my-queue", "my-exchange", "routing.key");

  // Close connection when done:
  await rabbit.close();
}

sendMessage().catch(console.error);