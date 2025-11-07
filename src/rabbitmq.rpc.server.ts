import { ConsumeMessage } from "amqplib";
import { QueueManager } from "./rabbitmq.queueManager";
import { RabbitMQConsumer, ConsumerOptions } from "./rabbitmq.consumer";
import { RabbitMQProducer, ProducerOptions } from "./rabbitmq.producer";

export type RPCRequestHandler = (request: any, reply: (response: any, options?: ProducerOptions) => void) => void;

export interface RPCServerOptions {
  consumerOptions?: ConsumerOptions;
  producerOptions?: ProducerOptions;
}

export class RabbitMQRPCServer {
  private consumer: RabbitMQConsumer;
  private producer: RabbitMQProducer;

  constructor(
    private readonly queueManager: QueueManager,
    private readonly options: RPCServerOptions = {}
  ) {
    this.consumer = new RabbitMQConsumer(queueManager);
    this.producer = new RabbitMQProducer(queueManager);
  }

  /**
   * Start listening for RPC requests on the specified queue
   */
  async listen(queueName: string, handler: RPCRequestHandler): Promise<void> {
    const consumerOptions = {
      ...this.options.consumerOptions,
      prefetch: 1,  // Process one request at a time to avoid blocking
    };

    await this.consumer.consume(
      queueName,
      async (msg: ConsumeMessage, ack: () => void, retry: () => void) => {
        try {
          // Parse the request body
          let requestBody;
          try {
            requestBody = JSON.parse(msg.content.toString());
          } catch (error) {
            console.error('Error parsing RPC request body:', error);
            // Send error response if parsing fails
            if (msg.properties.replyTo) {
              await this.producer.send(
                msg.properties.replyTo,
                { error: 'Invalid request body format' },
                {
                  correlationId: msg.properties.correlationId,
                  ...this.options.producerOptions
                }
              );
            }
            ack();
            return;
          }

          // Create reply function to send response back to the client
          const reply = async (response: any, options?: ProducerOptions) => {
            if (msg.properties.replyTo) {
              const replyOptions: ProducerOptions = {
                correlationId: msg.properties.correlationId,
                ...this.options.producerOptions,
                ...options
              };

              await this.producer.send(msg.properties.replyTo!, response, replyOptions);
            }
          };

          // Call the user-provided handler
          await handler(requestBody, reply);

          // Acknowledge successful processing
          ack();
        } catch (error) {
          console.error('Error processing RPC request:', error);
          // Optionally send error response
          if (msg.properties.replyTo) {
            try {
              await this.producer.send(
                msg.properties.replyTo,
                { error: error instanceof Error ? error.message : 'Unknown error' },
                {
                  correlationId: msg.properties.correlationId,
                  ...this.options.producerOptions
                }
              );
            } catch (replyError) {
              console.error('Error sending error response:', replyError);
            }
          }
          ack(); // Acknowledge to prevent reprocessing the error
        }
      },
      consumerOptions
    );
  }

  /**
   * Stop the RPC server
   */
  async stop(): Promise<void> {
    // Implementation for stopping the server would go here
    // For now, we'll just return
  }
}