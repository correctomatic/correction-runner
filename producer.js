import amqp from 'amqplib'
import connectionURL from './connection.js'

async function sendMessage(message) {
  try {
    // Connect to RabbitMQ server
    const connection = await amqp.connect(connectionURL())
    const channel = await connection.createChannel()

    // Declare the queue to which you want to send messages
    const queueName = 'pending_corrections'
    await channel.assertQueue(queueName, { durable: true })

    // Send the message to the queue
    channel.sendToQueue(queueName, Buffer.from(message), { persistent: true })
    console.log(`Message sent: ${message}`)

    // Close the channel and connection
    await channel.close()
    await connection.close()
  } catch (error) {
    console.error('Error:', error)
  }
}

// Example usage
const message = 'Hello, RabbitMQ! - ' + new Date().toISOString()
sendMessage(message)
