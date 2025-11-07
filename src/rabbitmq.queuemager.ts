import amqplib, { Channel, Options, ChannelModel } from "amqplib";

export class QueueManager {
  private readonly connections: Map<
    string,
    { model: ChannelModel; channel: Channel }
  > = new Map();
  private readonly reconnecting: Set<string> = new Set();
  private readonly reconnectDelay: number;
  constructor(
    private readonly url: string,
    private readonly options?: Options.Connect,
    reconnectDelayMs: number = 30000
  ) {
    if (!url) throw new Error("RabbitMQ URL is required.");
    this.reconnectDelay = reconnectDelayMs;
    this.setupGracefulShutdown();
  }

  private async createConnection(
    queueName: string
  ): Promise<{ model: ChannelModel; channel: Channel }> {
    const model = await amqplib.connect(this.url, {
      heartbeat: this.options?.heartbeat ?? 30,
      protocol: this.options?.protocol ?? "amqps",
      port: this.options?.port ?? 5671,
      ...this.options,
    });

    const connection = model.connection;
    const channel = await model.createChannel();

    await channel.assertQueue(queueName, { durable: true });

    // Listen for connection close
    connection.on("close", () => {
      console.error(`🔌 Connection closed for queue: ${queueName}`);
      this.handleReconnect(queueName);
    });

    connection.on("error", (err) => {
      console.error(`❌ Connection error on queue: ${queueName}`, err);
    });

    // Listen for channel close
    channel.on("close", () => {
      console.warn(`📴 Channel closed for queue: ${queueName}`);
      this.handleReconnect(queueName);
    });

    channel.on("error", (err) => {
      console.warn(`⚠️ Channel error for queue: ${queueName}`, err);
    });

    return { model, channel };
  }

  private handleReconnect(queueName: string): void {
    if (this.reconnecting.has(queueName)) return;

    this.reconnecting.add(queueName);
    this.connections.delete(queueName);

    setTimeout(async () => {
      try {
        console.log(`🔄 Reconnecting to queue: ${queueName}...`);
        const { model, channel } = await this.createConnection(queueName);
        this.connections.set(queueName, { model, channel });
        console.log(`✅ Reconnected to queue: ${queueName}`);
      } catch (err) {
        console.error(`❌ Failed to reconnect to queue: ${queueName}`, err);
      } finally {
        this.reconnecting.delete(queueName);
      }
    }, this.reconnectDelay);
  }

  async getOrCreateQueue(queueName: string): Promise<Channel> {
    const existing = this.connections.get(queueName);

    if (existing) {
      try {
        await existing.channel.checkQueue(queueName);
        return existing.channel;
      } catch (err) {
        console.warn(`⚠️ Channel stale for ${queueName}, reconnecting...`, err);
        this.handleReconnect(queueName);
        await this.delay(this.reconnectDelay);
        throw err;
      }
    }

    const { model, channel } = await this.createConnection(queueName);
    this.connections.set(queueName, { model, channel });
    return channel;
  }

  async closeQueue(queueName: string): Promise<void> {
    const entry = this.connections.get(queueName);
    if (entry) {
      try {
        await entry.channel.close();
        await entry.model.close();
      } catch (err) {
        console.error(`❌ Error closing queue: ${queueName}`, err);
      } finally {
        this.connections.delete(queueName);
      }
    }
  }

  async closeAll(): Promise<void> {
    for (const [queueName, { model, channel }] of this.connections) {
      try {
        await channel.close();
        await model.close();
      } catch (err) {
        console.error(`❌ Error closing queue: ${queueName}`, err);
      }
    }
    this.connections.clear();
    console.log("✅ All RabbitMQ connections closed.");
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`⚠️ Received ${signal}. Closing RabbitMQ connections...`);
      await this.closeAll();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
