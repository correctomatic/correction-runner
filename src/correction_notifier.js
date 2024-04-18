import dotenv from 'dotenv'
dotenv.config()

/*
TO-DO: Read messages from finished_corrections and call the URL
*/
import {getMessageChannel, FINISHED_QUEUE}  from './servers/rabbitmq_connection.js'

async function mainLoop() {
  try {
    const channel = await getMessageChannel()

    console.log('Waiting for messages...')
    channel.consume(FINISHED_QUEUE, async (message) => {
      try {
        if (message === null) return
        console.log('Received message:', message.content.toString())
        const finishedTask = JSON.parse(message.content.toString())

        // TO-DO: Call the URL

        //channel.ack(message)
      } catch (error) {
        console.error('Error:', error)
      }
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

initializeDocker()
mainLoop()
