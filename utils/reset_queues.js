import {
  PENDING_QUEUE_NAME,
  RUNNING_QUEUE_NAME,
  FINISHED_QUEUE_NAME,

  PENDING_QUEUE_CONFIG,
  RUNNING_QUEUE_CONFIG,
  FINISHED_QUEUE_CONFIG
} from '../src/config/bullmq.js'
import { deleteQueue } from '../src/lib/delete_queue.js'
import readline from 'readline'

function deleteQueues() {
  console.log('Deleting queues...')
  deleteQueue(PENDING_QUEUE_NAME, PENDING_QUEUE_CONFIG)
  deleteQueue(RUNNING_QUEUE_NAME, RUNNING_QUEUE_CONFIG)
  deleteQueue(FINISHED_QUEUE_NAME, FINISHED_QUEUE_CONFIG)
}

function shuffleArray(arr) {
  return arr.map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function userConfirmation() {

  const options = [ 'Yes', 'No' , 'No' , 'No' , 'No' ]
  const shuffledOptions = shuffleArray(options)

  console.log('Do you really want to reset the queues?:')
  shuffledOptions.forEach((option, index) => {
    console.log(`${index + 1}. ${option}`)
  })

  const answer = await askQuestion('Enter a number (1-5): ')
  const choice = parseInt(answer, 10)

  if (choice >= 1 && choice <= options.length) {
    return shuffledOptions[choice - 1] === 'Yes'
  }

  console.log('Invalid choice. Exiting.')
  return false
}

if (await userConfirmation()) deleteQueues()
