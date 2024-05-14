
/*
TO-DO: Read messages from finished_corrections and call the URL


This architecture is fine for a small number of messages, but it is not scalable.
Rewrite using systems like agenda.js or bull.js

BullMQ seems to be the best option for this case, but we should rewrite the other parts of the system to use it.
https://www.dragonflydb.io/guides/bullmq
https://docs.bullmq.io/guide/retrying-failing-jobs
*/
import {getMessageChannel, FINISHED_QUEUE}  from './servers/rabbitmq_connection.js'

async function notifyURL(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Notification message' }),
  })
  if(!response.ok) {
    throw new Error(`Failed to send notification to ${url}. Status: ${response.status}`)
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, retryInterval))
}

const BASE_RETRY_INTERVAL = 1000 // in milliseconds
const EXPONENTIAL_FACTOR = 2
const MAX_RETRIES = 5

function retryInterval(retry) {
  if (retry === 1) return 0
  return Math.pow(EXPONENTIAL_FACTOR, retry - 1) * BASE_RETRY_INTERVAL
}

async function notifyWithRetries(channel, url, retry) {

  await wait(retryInterval(retry)) // Will be 0 for the first attempt

  try {
      await notifyURL(url)
      console.log('Notification sent successfully to', url)
      channel.ack(msg)
  } catch (error) {
    console.error(error.message)

    if (retries ===  MAX_RETRIES) {
      console.log(`Max retries reached for ${url}`)
      return
    }
    console.log(`Retrying in  ${retryInterval} milliseconds...`)
    notifyWithRetries(channel, url, retry + 1)
  }
}

async function mainLoop() {
  try {
    const channel = await getMessageChannel()

    console.log('Notifier waiting for RabbitMQ messages...')
    channel.consume(FINISHED_QUEUE, async (message) => {
      try {
        if (message === null) return
        console.log('Received message:', message.content.toString())
        const finishedTask = JSON.parse(message.content.toString())

        // TO-DO: Call the URL
        //notifyWithRetries(channel, finishedTask.url, 1)

        //channel.ack(message)
      } catch (error) {
        console.error('Error:', error)
      }
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

mainLoop()
