import dotenv from 'dotenv'
import {initializeDocker as initDocker } from './lib/docker.js'

dotenv.config()

const DOCKER_SERVER = process.env.DOCKER_SERVER

function initializeDocker() {
  initDocker(DOCKER_SERVER)
}

export default initializeDocker
