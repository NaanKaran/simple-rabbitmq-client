import { EventEmitter } from "events";
import { ConsumeMessage } from "amqplib";
import {
  QueueManager,
  RabbitMQConsumer,
  RabbitMQProducer,
  RabbitMQManager,
  RabbitMqConfig,
  ConsumerOptions,
  ProducerOptions,
} from "./index";

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

/**
 * Options for declaring queues
 */
export interface QueueOptions {
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: any;
}

/**
 * Quality of Service options for consumers
 */
export interface QoSOptions {
  prefetchCount?: number;
  prefetchSize?: number;
  global?: boolean;
}

/**
 * Options for declaring exchanges
 */
export interface ExchangeOptions {
  exchange: string;
  type: "direct" | "topic" | "headers" | "fanout" | "match" | string;
  durable?: boolean;
  internal?: boolean;
  autoDelete?: boolean;
  alternateExchange?: string;
  arguments?: any;
}

/**
 * Queue binding configuration
 */
export interface QueueBinding {
  exchange: string;
  routingKey: string;
  arguments?: any;
}

/**
 * Base options for consumer configuration
 */
export interface EnhancedConsumerOptionsBase {
  queue: string;
  queueOptions?: QueueOptions;
  qos?: QoSOptions;
  exchanges?: ExchangeOptions[];
  queueBindings?: QueueBinding[];
  consumerOptions?: Partial<ConsumerOptions>;
}

/**
 * Complete consumer options including handler
 */
export interface EnhancedConsumerOptions extends EnhancedConsumerOptionsBase {
  handler: (msg: any) => Promise<void | number>;
}

/**
 * Options for enhanced producer
 */
export interface EnhancedProducerOptions {
  queue: string;
  queueOptions?: QueueOptions;
}

/**
 * Options for simple producer only
 */
export interface ProducerOptionsOnly {
  queueOptions?: QueueOptions;
}

/**
 * Options for publisher
 */
export interface EnhancedPublisherOptions {
  confirm?: boolean;
  maxAttempts?: number;
  exchanges?: ExchangeOptions[];
  producerOptions?: Partial<ProducerOptions>;
}

/**
 * Metadata for message routing
 */
export interface MessageMetadata {
  exchange?: string;
  routingKey?: string;
  queue?: string;
}

// ============================================================================
// PRODUCER CLASSES
// ============================================================================

/**
 * Simple Producer class that provides a consistent interface with a send method
 */
export class SimpleProducer extends EventEmitter {
  private readonly rabbitProducer: RabbitMQProducer;
  private readonly queueName: string;
  private readonly queueManager: QueueManager;
  private readonly options: ProducerOptionsOnly;

  constructor(
    queueManager: QueueManager,
    queueName: string,
    options?: ProducerOptionsOnly
  ) {
    super();
    this.queueManager = queueManager;
    this.rabbitProducer = new RabbitMQProducer(queueManager);
    this.queueName = queueName;
    this.options = options || {};
  }

  /**
   * Send a message to the queue
   * @param message The message to send
   * @returns Promise<boolean> indicating success
   */
  async send(message: any): Promise<boolean> {
    try {
      return await this.rabbitProducer.send(this.queueName, message);
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      this.emit("error", typedError);
      throw typedError;
    }
  }

  /**
   * Close the producer (cleanup)
   */
  async close(): Promise<void> {
    // No specific cleanup needed for simple producer, but keeping for consistency
  }
}

/**
 * Enhanced Producer class with more features
 */
export class EnhancedProducer extends EventEmitter {
  private readonly rabbitProducer: RabbitMQProducer;
  private readonly queueManager: QueueManager;
  private readonly queueName: string;
  private readonly options: EnhancedProducerOptions;
  private readonly manager: RabbitMQManager;

  constructor(
    queueManager: QueueManager,
    queueName: string,
    options: Omit<EnhancedProducerOptions, "queue"> & { queue?: string } = {}
  ) {
    super();
    this.queueManager = queueManager;
    this.rabbitProducer = new RabbitMQProducer(queueManager);
    this.queueName = queueName;
    this.options = { ...options, queue: options.queue || queueName };
    this.manager = new RabbitMQManager(queueManager);
  }

  /**
   * Initialize the producer by declaring the queue if options are provided
   */
  async init(): Promise<void> {
    if (this.options.queueOptions) {
      await this.manager.declareQueue(
        this.queueName,
        this.options.queueOptions
      );
    }
  }

  /**
   * Send a message to the queue
   * @param message The message to send
   * @returns Promise<boolean> indicating success
   */
  async send(message: any): Promise<boolean> {
    try {
      if (this.options.queueOptions) {
        await this.init();
      }
      return await this.rabbitProducer.send(this.queueName, message);
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      this.emit("error", typedError);
      throw typedError;
    }
  }

  /**
   * Close the producer (cleanup)
   */
  async close(): Promise<void> {
    // No specific cleanup needed, but keeping for consistency
  }
}

/**
 * Publisher class that provides advanced routing capabilities with retry logic
 */
export class Publisher extends EventEmitter {
  private readonly rabbitProducer: RabbitMQProducer;
  private readonly queueManager: QueueManager;
  private readonly options: EnhancedPublisherOptions;
  private readonly manager: RabbitMQManager;
  private initialized: boolean = false;

  constructor(
    queueManager: QueueManager,
    options: EnhancedPublisherOptions = {}
  ) {
    super();
    this.queueManager = queueManager;
    this.rabbitProducer = new RabbitMQProducer(queueManager);
    this.options = {
      confirm: false,
      maxAttempts: 3,
      exchanges: [],
      producerOptions: {},
      ...options,
    };
    this.manager = new RabbitMQManager(queueManager);
  }

  /**
   * Initialize the publisher by declaring exchanges if options are provided
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    if (this.options.exchanges && this.options.exchanges.length > 0) {
      for (const exchange of this.options.exchanges) {
        try {
          await this.manager.declareExchange(exchange.exchange, {
            type: exchange.type,
            durable: exchange.durable,
            internal: exchange.internal,
            autoDelete: exchange.autoDelete,
            alternateExchange: exchange.alternateExchange,
            arguments: exchange.arguments,
          });
        } catch (error) {
          const typedError = error instanceof Error ? error : new Error(String(error));
          this.emit(
            "error",
            new Error(
              `Failed to declare exchange ${exchange.exchange}: ${typedError.message}`
            )
          );
          throw typedError;
        }
      }
    }

    this.initialized = true;
  }

  /**
   * Send a message with retry logic
   * @param destination The destination (queue name or MessageMetadata)
   * @param message The message to send
   */
  async send(
    destination: string | MessageMetadata,
    message: any
  ): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    const maxAttempts = this.options.maxAttempts || 1;
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (typeof destination === "string") {
          // Send directly to queue
          await this.rabbitProducer.send(
            destination,
            message,
            this.options.producerOptions
          );
        } else {
          // Send to exchange with routing key
          if (destination.exchange && destination.routingKey) {
            await this.rabbitProducer.sendToExchange(
              destination.exchange,
              destination.routingKey,
              message,
              this.options.producerOptions
            );
          } else if (destination.queue) {
            await this.rabbitProducer.send(
              destination.queue,
              message,
              this.options.producerOptions
            );
          } else {
            throw new Error(
              "Invalid destination: must specify either exchange/routingKey or queue"
            );
          }
        }

        // Success, exit retry loop
        return;
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          // Final attempt failed, emit error and re-throw
          const typedError = error instanceof Error ? error : new Error(String(error));
          this.emit("error", typedError);
          throw typedError;
        }

        // Wait before retry with exponential backoff
        const delay = Math.pow(2, attempt) * 1000; // 2^attempt * 1 second
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should not be reached, but added for type safety
    if (lastError instanceof Error) {
      throw lastError;
    } else {
      throw new Error(String(lastError));
    }
  }

  /**
   * Close the publisher (cleanup)
   */
  async close(): Promise<void> {
    // Clean up resources if needed
    // For now, just return since we don't have advanced confirmation handling
  }
}

// ============================================================================
// CONSUMER CLASS
// ============================================================================

/**
 * Consumer class that handles message consumption with event handling
 */
export class Consumer extends EventEmitter {
  private readonly rabbitConsumer: RabbitMQConsumer;
  private readonly queueManager: QueueManager;
  private stopFunction: (() => Promise<void>) | null = null;
  private readonly queue: string;

  constructor(queueManager: QueueManager, config: EnhancedConsumerOptions) {
    super();
    this.queueManager = queueManager;
    this.rabbitConsumer = new RabbitMQConsumer(queueManager);
    this.queue = config.queue;
  }

  /**
   * Initialize the consumer with the given configuration
   */
  async init(config: EnhancedConsumerOptions): Promise<void> {
    const manager = new RabbitMQManager(this.queueManager);

    // Declare queue if options provided
    if (config.queueOptions) {
      await manager.declareQueue(config.queue, config.queueOptions);
    }

    // Declare exchanges if provided
    if (config.exchanges) {
      for (const exchange of config.exchanges) {
        await manager.declareExchange(exchange.exchange, {
          type: exchange.type,
          durable: exchange.durable,
          internal: exchange.internal,
          autoDelete: exchange.autoDelete,
          alternateExchange: exchange.alternateExchange,
          arguments: exchange.arguments,
        });
      }
    }

    // Bind queue to exchanges if provided
    if (config.queueBindings) {
      for (const binding of config.queueBindings) {
        await manager.bindQueue(
          config.queue,
          binding.exchange,
          binding.routingKey
        );
      }
    }

    // Set up QoS if provided
    if (config.qos) {
      // This would need to be handled in the consume call
    }

    // Start consuming
    const consumerOptions = config.consumerOptions || {};

    this.stopFunction = await new Promise((resolve) => {
      this.rabbitConsumer.consume(
        config.queue,
        async (msg: ConsumeMessage, ack, retry) => {
          try {
            const messageContent = JSON.parse(msg.content.toString());
            const result = await config.handler(messageContent);

            // Handle result codes for different acknowledgment behaviors
            if (result === 0) {
              // Explicit NACK
              retry();
            } else {
              // Default behavior is ACK
              ack();
            }
          } catch (error) {
            this.emit("error", error);
            // On error, we can retry or potentially send to DLQ based on configuration
            await retry();
          }
        },
        consumerOptions
      );

      // Return a function to stop the consumer
      resolve(async () => {
        await this.rabbitConsumer.stop(config.queue);
      });
    });
  }

  /**
   * Close the consumer
   */
  async close(): Promise<void> {
    if (this.stopFunction) {
      await this.stopFunction();
    }
  }
}

// ============================================================================
// CONNECTION CLASS
// ============================================================================

/**
 * Main Connection class that manages RabbitMQ connections with event handling
 */
export class Connection extends EventEmitter {
  private readonly queueManager: QueueManager;

  constructor(connectionString: string, options?: Partial<RabbitMqConfig>) {
    super();

    const config: RabbitMqConfig = {
      url: connectionString,
      maxRetries: 5,
      retryDelay: 5000,
      heartbeat: 30,
      ...options,
    };

    this.queueManager = new QueueManager(config);

    // Set up event forwarding for connection events
    this.setupEventForwarding();
  }

  /**
   * Set up event forwarding for connection events
   */
  private setupEventForwarding(): void {
    // Forward connection events from QueueManager
    this.queueManager.on("error", (err) => {
      this.emit("error", err);
    });

    this.queueManager.on("close", (info) => {
      this.emit("close", info);
    });

    // Emit connection event after initialization
    setImmediate(() => {
      this.emit("connection");
    });
  }

  /**
   * Create a consumer with enhanced options
   */
  async createConsumer(
    config: EnhancedConsumerOptionsBase,
    handler: (msg: any) => Promise<void | number>
  ): Promise<Consumer> {
    const fullConfig: EnhancedConsumerOptions = { ...config, handler };
    const consumer = new Consumer(this.queueManager, fullConfig);
    await consumer.init(fullConfig);
    return consumer;
  }

  /**
   * Create a producer with overloaded methods based on parameters
   */
  async createProducer(
    options: EnhancedProducerOptions
  ): Promise<EnhancedProducer>;
  async createProducer(
    queueName: string,
    options?: ProducerOptionsOnly
  ): Promise<SimpleProducer>;

  async createProducer(
    arg1: string | EnhancedProducerOptions,
    arg2?: ProducerOptionsOnly
  ): Promise<SimpleProducer | EnhancedProducer> {
    if (typeof arg1 === "string") {
      // Called as createProducer(queueName, options?)
      const queueName = arg1;
      const queueOptions = arg2?.queueOptions;

      // Declare queue if not exists (with the options provided)
      if (queueOptions) {
        const manager = new RabbitMQManager(this.queueManager);
        await manager.declareQueue(queueName, queueOptions);
      }

      // Return a SimpleProducer instance
      return new SimpleProducer(this.queueManager, queueName, arg2);
    } else {
      // Called as createProducer(options) - EnhancedProducerOptions with required 'queue' property
      const options = arg1 as EnhancedProducerOptions;
      const queueName = options.queue;

      // Declare queue if not exists (with the options provided)
      if (options.queueOptions) {
        const manager = new RabbitMQManager(this.queueManager);
        await manager.declareQueue(queueName, options.queueOptions);
      }

      // Return an EnhancedProducer instance
      return new EnhancedProducer(this.queueManager, queueName, options);
    }
  }

  /**
   * Create a publisher with enhanced options
   */
  async createPublisher(
    options: EnhancedPublisherOptions = {}
  ): Promise<Publisher> {
    const publisher = new Publisher(this.queueManager, options);
    await publisher.init();
    return publisher;
  }

  /**
   * Send a message directly to an exchange
   */
  async sendToExchange(
    exchangeName: string,
    routingKey: string,
    message: any
  ): Promise<void> {
    const producer = new RabbitMQProducer(this.queueManager);
    await producer.sendToExchange(exchangeName, routingKey, message);
  }

  /**
   * Declare a queue
   */
  async queueDeclare(
    queueName: string,
    options: QueueOptions = {}
  ): Promise<void> {
    const manager = new RabbitMQManager(this.queueManager);
    await manager.declareQueue(queueName, options);
  }

  /**
   * Declare an exchange
   */
  async exchangeDeclare(
    exchangeName: string,
    type: string,
    options: Omit<ExchangeOptions, "exchange" | "type"> = {}
  ): Promise<void> {
    const manager = new RabbitMQManager(this.queueManager);
    await manager.declareExchange(exchangeName, { type, ...options });
  }

  /**
   * Bind a queue to an exchange
   */
  async queueBind(
    queueName: string,
    exchangeName: string,
    routingKey: string
  ): Promise<void> {
    const manager = new RabbitMQManager(this.queueManager);
    await manager.bindQueue(queueName, exchangeName, routingKey);
  }

  /**
   * Close the connection and all resources
   */
  async close(): Promise<void> {
    await this.queueManager.closeAll();
  }
}
