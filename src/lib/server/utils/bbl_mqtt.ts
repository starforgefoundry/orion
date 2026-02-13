import mqtt from 'mqtt';

type MQTTMessageCallback = (message: object, unsubscribe: () => void) => void;

export class BambuMQTT {
  client: mqtt.MqttClient;
  deviceId: string;
  callbackMap: Map<string, MQTTMessageCallback> = new Map();

  constructor(userId: string, authKey: string, deviceId: string) {
    this.deviceId = deviceId;

    if (!userId.startsWith('u_')) {
      userId = `u_${userId}`;
    }

    this.client = mqtt.connect('mqtts://us.mqtt.bambulab.com:8883', {
      username: userId,
      password: authKey,
      keepalive: 60,
      clientId: `bambu-client-${deviceId}`,
    });

    this.client.on('connect', () => {
      console.log(`Connected to MQTT broker for device ${deviceId}`);
    });

    this.client.on('message', (topic, message) => {
      for (const [id, callback] of this.callbackMap.entries()) {
        callback(JSON.parse(message.toString()), () => {
          this.callbackMap.delete(id);
        });
      }
    });

    this.client.on('error', (err) => {
      console.error(`MQTT connection error for device ${deviceId}:`, err);
    });
  }

  connect() {
    return new Promise<void>((resolve, reject) => {
      this.client.on('connect', () => resolve());
      this.client.on('error', (err) => reject(err));
    });
  }

  command(payload: string | object) {
    if (typeof payload === 'object') {
      payload = JSON.stringify(payload);
    }

    console.log(`Publishing command to device ${this.deviceId}: ${payload}`);

    // Publish a command to the device's topic
    this.publish(`device/${this.deviceId}/request`, payload);
  }

  publish(topic: string, message: string | object) {
    if (typeof message === 'object') {
      message = JSON.stringify(message);
    }

    // Publish a message to a specific topic
    this.client.publish(topic, message);
  }

  subscribe(topic: string, callback: MQTTMessageCallback) {
    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to topic ${topic}:`, err);
        return;
      }

      this.callbackMap.set(crypto.randomUUID(), callback);
    });
  }

  async waitForMessage(
    topic: string,
    predicate: (message: object) => boolean,
    timeout: number = 5000,
  ): Promise<object> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for MQTT message'));
      }, timeout);

      this.subscribe(topic, (message, unsubscribe) => {
        if (predicate(message)) {
          clearTimeout(timer);
          unsubscribe();
          resolve(message);
        }
      });
    });
  }

  disconnect() {
    this.client.end();
  }
}
