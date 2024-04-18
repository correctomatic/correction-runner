import {initializeDocker as initDocker } from '../lib/docker.js'

const DOCKER_SERVER = process.env.DOCKER_SERVER

function initializeDocker() {
  initDocker(DOCKER_SERVER)
}

export default initializeDocker
