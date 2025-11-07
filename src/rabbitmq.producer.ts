import { QueueManager } from "./rabbitmq.queuemager";

export class RabbitMQProducer {
  constructor(private readonly queueManager: QueueManager) {}

  async send(queueName: string, message: string): Promise<boolean> {
    const channel = await this.queueManager.getOrCreateQueue(queueName);
    const buffer = Buffer.from(message);
    let response = channel.sendToQueue(queueName, buffer);
    return response;
  }
}
