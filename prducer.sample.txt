import {
  QueueManager,
  RabbitMQConsumer,
  RabbitMQProducer,
} from "rabbitmq-connect-helper";

const username = "admin";
const password = encodeURIComponent("StrongPassword123");
const host = "localhost"; // Or your RabbitMQ server address

const rabbitMqUrl = `amqp://${username}:${password}@${host}`;
// Create a new instance of QueueManager

const queueManager = new QueueManager(rabbitMqUrl);
const producer = new RabbitMQProducer(queueManager);

for (let i = 1; i <= 5; i++) {
  // publish a message to a queue
  await producer.send("myQueue", `Hello World ${i}`);
}
