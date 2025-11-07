import { QueueManager } from "../rabbitmq.queuemager";
import { RabbitMQConsumer } from "../rabbitmq.consumer";
import { RabbitMQProducer } from "../rabbitmq.producer";
import mockAmqplib from "amqplib";

const username = "admin";
const password = encodeURIComponent("StrongPassword123");
const host = "localhost"; // Or your RabbitMQ server address

const rabbitMqUrl = `amqp://${username}:${password}@${host}`; // Replace with your RabbitMQ URL
jest.setTimeout(20000);
describe("QueueManager", () => {
  let queueManager: QueueManager;
  let consumer: RabbitMQConsumer;
  let producer: RabbitMQProducer;

  beforeEach(() => {
    queueManager = new QueueManager(rabbitMqUrl);
    consumer = new RabbitMQConsumer(queueManager);
    producer = new RabbitMQProducer(queueManager);
  });

  afterEach(async () => {
    await queueManager.closeAll();
  });

  it("should create a connection and channel for a new queue and produce message", async () => {
    const queueName = "testQueue";
    const message = "test message";
    let result = await producer.send(queueName, message);
    expect(result).toBeTruthy();
  });

  it("should create a connection and channel for a new queue and consume message", async () => {
    const queueName = "testQueue";
    const message = "test message";

    // Send a message to the queue
    const result = await producer.send(queueName, message);
    expect(result).toBeTruthy();

    // Wait for the message to be consumed
    const consumedMessage = await new Promise<string>((resolve) => {
      consumer.consume(
        queueName,
        async (msg, ack, retry) => {
          throw new Error("Simulated failure");

          ack();
        },
        {
          prefetch: 5,
          retryAttempts: 3,
          retryDelayMs: 3000,
        }
      );

      // consumer
      //   .consume(queueName, async (msg, ack, nack) => {
      //     try {
      //       if (msg) {
      //         const messageContent = msg.content.toString();
      //         ack(); // Acknowledge the message
      //         resolve(messageContent); // Resolve the promise with the message content
      //       } else {
      //         nack(); // Negative acknowledgment if no message
      //       }
      //     } catch (error) {
      //       nack(); // Ensure nack is called on error
      //       console.error("Error consuming message:", error);
      //     }
      //   })
      //   .catch((error) => {
      //     console.error("Error setting up consumer:", error);
      //   });
    });

    console.log(consumedMessage); // Log the consumed message
    expect(consumedMessage).toBe(message); // Assert the consumed message matches
  });
});
