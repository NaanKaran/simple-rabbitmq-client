import { Channel, ConsumeMessage } from "amqplib";
import { QueueManager } from "./rabbitmq.queueManager";
import { RabbitMQConsumer } from "./rabbitmq.consumer";
import { RabbitMQProducer, ProducerOptions } from "./rabbitmq.producer";

export interface RPCOptions {
  timeout?: number;  // Timeout in milliseconds for RPC calls
  confirm?: boolean; // Whether to use publisher confirms
}

export interface RPCResponse {
  body: any;
  headers?: any;
  correlationId: string;
}

export interface RPCRequest {
  body: any;
  headers?: any;
  correlationId: string;
  replyTo: string;
}

export class RabbitMQRPCClient {
  private correlationIdCounter = 0;
  private pendingRequests = new Map<string, { resolve: (value: any) => void, reject: (reason: any) => void, timeoutId: NodeJS.Timeout }>();
  private responseConsumerTag: string | null = null;
  private responseQueue: string;

  constructor(
    private readonly queueManager: QueueManager,
    private readonly producer: RabbitMQProducer,
    private readonly options: RPCOptions = {}
  ) {
    // Create a unique response queue for this client
    this.responseQueue = `rpc-response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize the RPC client by setting up response queue and consumer
   */
  async init(): Promise<void> {
    const channel = await this.queueManager.getOrCreateQueue(this.responseQueue);
    
    // Set up consumer for responses
    this.responseConsumerTag = await new Promise((resolve, reject) => {
      channel.consume(this.responseQueue, (msg: ConsumeMessage | null) => {
        if (!msg) return;
        
        // Process the response
        this.handleResponse(msg);
      }, { noAck: true }).then(consumeResult => {
        resolve(consumeResult.consumerTag);
      }).catch(reject);
    });
  }

  /**
   * Handle incoming response messages
   */
  private handleResponse(msg: ConsumeMessage): void {
    const correlationId = msg.properties.correlationId;
    const pendingRequest = this.pendingRequests.get(correlationId);
    
    if (pendingRequest) {
      // Clear the timeout
      clearTimeout(pendingRequest.timeoutId);
      
      // Remove from pending requests
      this.pendingRequests.delete(correlationId);
      
      try {
        // Parse the response body
        const body = JSON.parse(msg.content.toString());
        pendingRequest.resolve({ body, headers: msg.properties.headers, correlationId });
      } catch (error) {
        pendingRequest.reject(error);
      }
    }
  }

  /**
   * Send an RPC request and wait for response
   */
  async send(queueName: string, body: any, options?: ProducerOptions): Promise<RPCResponse> {
    return new Promise((resolve, reject) => {
      // Generate a unique correlation ID for this request
      const correlationId = `rpc-${this.correlationIdCounter++}-${Date.now()}`;
      
      // Default timeout is 30 seconds if not specified
      const timeout = this.options.timeout || 30000;
      
      // Create timeout for this request
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`RPC request timeout after ${timeout}ms`));
      }, timeout);

      // Store the promise handlers with the correlation ID
      this.pendingRequests.set(correlationId, { resolve, reject, timeoutId });

      // Send the request with appropriate options
      const requestOptions: ProducerOptions = {
        ...options,
        correlationId,
        replyTo: this.responseQueue,
        persistent: true  // Ensure request is persistent by default
      };

      // Send the message using the producer
      this.producer.send(queueName, body, requestOptions)
        .catch(err => {
          // If sending failed, reject the promise
          clearTimeout(timeoutId);
          this.pendingRequests.delete(correlationId);
          reject(err);
        });
    });
  }



  /**
   * Close the RPC client
   */
  async close(): Promise<void> {
    // Clear all pending timeouts
    for (const [_, pendingRequest] of this.pendingRequests) {
      clearTimeout(pendingRequest.timeoutId);
    }
    
    // Clear pending requests
    this.pendingRequests.clear();
    
    // Cancel response consumer if it exists
    if (this.responseConsumerTag) {
      const channel = await this.queueManager.getOrCreateQueue('default');
      await channel.cancel(this.responseConsumerTag);
      this.responseConsumerTag = null;
    }
  }
}