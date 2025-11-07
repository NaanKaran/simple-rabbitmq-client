import { Channel, ConsumeMessage, Options } from "amqplib";
import { QueueManager } from "./rabbitmq.queuemager";

interface ConsumerOptions {
  prefetch?: number;
  consumerOptions?: Options.Consume;
  retryAttempts?: number;
  retryDelayMs?: number;
  deadLetterQueueSuffix?: string;
}

interface QueueMetrics {
  ack: number;
  nack: number;
  errors: number;
}

export class RabbitMQConsumer {
  private readonly activeConsumers = new Map<string, () => Promise<void>>();
  private readonly pausedQueues = new Set<string>();
  private readonly metrics: Record<string, QueueMetrics> = {};
  private readonly messageAttempts = new WeakMap<ConsumeMessage, number>();

  constructor(private readonly queueManager: QueueManager) {}

  async consume(
    queueName: string,
    onMessage: (
      msg: ConsumeMessage,
      ack: () => void,
      retry: () => void
    ) => Promise<void>,
    options: ConsumerOptions = {}
  ): Promise<void> {
    const {
      prefetch = 1,
      consumerOptions = {},
      retryAttempts = 3,
      retryDelayMs = 180000,
      deadLetterQueueSuffix = ".DLQ",
    } = options;

    const setupConsumer = async () => {
      try {
        const channel = await this.queueManager.getOrCreateQueue(queueName);
        channel.prefetch(prefetch);

        this.metrics[queueName] ||= { ack: 0, nack: 0, errors: 0 };

        const consumeHandler = this.createConsumeHandler(
          queueName,
          channel,
          onMessage,
          retryAttempts,
          retryDelayMs,
          deadLetterQueueSuffix
        );

        const { consumerTag } = await channel.consume(
          queueName,
          consumeHandler,
          {
            noAck: false,
            ...consumerOptions,
          }
        );

        // Save the stop method
        this.activeConsumers.set(queueName, async () => {
          await channel.cancel(consumerTag);
          console.log(`Stopped consumer for: ${queueName}`);
        });

        // Reconnect logic
        channel.on("close", async () => {
          console.warn(
            `Channel closed for ${queueName}. Retrying in ${retryDelayMs}ms...`
          );
          this.activeConsumers.delete(queueName);
          setTimeout(
            () => this.consume(queueName, onMessage, options),
            retryDelayMs
          );
        });

        channel.on("error", (err) => {
          console.error(`Channel error on ${queueName}:`, err);
        });

        console.log(`Started consuming ${queueName} with prefetch=${prefetch}`);
      } catch (err) {
        console.error(
          `Error setting up consumer for ${queueName}, retrying in ${retryDelayMs}ms`,
          err
        );
        setTimeout(setupConsumer, retryDelayMs);
      }
    };

    await setupConsumer();
  }

  private createConsumeHandler(
    queueName: string,
    channel: Channel,
    onMessage: (
      msg: ConsumeMessage,
      ack: () => void,
      retry: () => void
    ) => Promise<void>,
    retryAttempts: number,
    retryDelayMs: number,
    deadLetterQueueSuffix: string
  ) {
    return (msg: ConsumeMessage | null) => {
      if (!msg || this.pausedQueues.has(queueName)) return;

      const ack = () => {
        try {
          channel.ack(msg);
          this.metrics[queueName].ack++;
          this.messageAttempts.delete(msg);
        } catch (err) {
          console.warn(`Ack failed for ${queueName}:`, err);
        }
      };

      const retry = async () => {
        const attempt = (this.messageAttempts.get(msg) ?? 0) + 1;
        this.messageAttempts.set(msg, attempt);

        if (attempt <= retryAttempts) {
          console.warn(`Retry ${attempt}/${retryAttempts} for ${queueName}`);
          setTimeout(
            () =>
              this.createConsumeHandler(
                queueName,
                channel,
                onMessage,
                retryAttempts,
                retryDelayMs,
                deadLetterQueueSuffix
              )(msg),
            retryDelayMs
          );
        } else {
          await this.moveToDLQ(queueName, msg, deadLetterQueueSuffix);
          ack();
        }
      };

      (async () => {
        try {
          await onMessage(msg, ack, retry);
        } catch (err) {
          console.error(`Processing error in ${queueName}:`, err);
          await retry();
        }
      })();
    };
  }

  private async moveToDLQ(
    queueName: string,
    msg: ConsumeMessage,
    suffix: string
  ) {
    try {
      const dlqName = `${queueName}${suffix}`;
      const dlqChannel = await this.queueManager.getOrCreateQueue(dlqName);
      dlqChannel.sendToQueue(dlqName, msg.content, {
        headers: msg.properties.headers,
        persistent: true,
      });
      this.metrics[queueName].errors++;
      console.error(`Moved message to DLQ: ${dlqName}`);
    } catch (err) {
      console.error(`Failed to move message to DLQ for ${queueName}:`, err);
    }
  }

  pause(queueName: string): void {
    this.pausedQueues.add(queueName);
    console.log(`Paused consuming from: ${queueName}`);
  }

  resume(queueName: string): void {
    if (this.pausedQueues.delete(queueName)) {
      console.log(`Resumed consuming from: ${queueName}`);
    }
  }

  async stop(queueName: string): Promise<void> {
    const stop = this.activeConsumers.get(queueName);
    if (stop) {
      await stop();
      this.activeConsumers.delete(queueName);
    }
    this.pausedQueues.delete(queueName);
  }

  getMetrics(): Record<string, QueueMetrics> {
    return this.metrics;
  }
}
