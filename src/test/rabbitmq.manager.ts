import { QueueManager } from "../rabbitmq.queuemager";
import { RabbitMQConsumer } from "../rabbitmq.consumer";
import { RabbitMQProducer } from "../rabbitmq.producer";

// Configuration
const rabbitMqConfig = {
  url: "amqp://localhost",
};

const queueManager = new QueueManager(rabbitMqConfig.url);
const consumer = new RabbitMQConsumer(queueManager);
const producer = new RabbitMQProducer(queueManager);

// Export for application use
export { queueManager, consumer, producer };
