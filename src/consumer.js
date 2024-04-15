import amqp from 'amqplib'
import connectionURL, {PENDING_QUEUE}  from './connection.js'

async function receiveMessages() {
  try {
    // Connect to RabbitMQ server
    const connection = await amqp.connect(connectionURL())
    const channel = await connection.createChannel()

    // Consume messages from the queue
    console.log('Waiting for messages...')
    channel.consume(PENDING_QUEUE, (message) => {
      if (message !== null) {
        console.log('Received message:', message.content.toString())
        // Acknowledge receipt of the message
        channel.ack(message)
      }
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

receiveMessages()
