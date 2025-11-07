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
const consumer = new RabbitMQConsumer(queueManager);

await consumer.consume("myQueue", (msg) => {
  console.log(msg);
});
