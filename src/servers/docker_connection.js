import fs from 'fs'

import {initializeDockerode } from '../lib/docker.js'
import env from '../config/env.js'

function logAndRethrow(errorText, logger=console) {
  logger.error(errorText)
  throw new Error(errorText)
}

async function initializeDocker(logger=console) {

  function parseOptions(dockerOptions) {
    try {
      return JSON.parse(dockerOptions)
    }catch(error) {
      const errorText = `Error parsing DOCKER_OPTIONS: ${error.message}`
      logAndRethrow(errorText, logger)
    }
  }

  function readFiles(options){

    const optionsWithFiles = { ...options }
    const fileAttributes = ['cert', 'key', 'ca', 'sshOptions.privateKey']

    for(const attribute of fileAttributes) {
      if(!options[`${attribute}`]) continue

      try {
        optionsWithFiles[attribute] = fs.readFileSync(options[attribute])
      } catch (error) {
        const errorText = `Error reading file for attribute "${attribute}": ${error.message}`
        logAndRethrow(errorText, logger)
      }
    }
    return optionsWithFiles
  }

  const options = parseOptions(env.docker.DOCKER_OPTIONS)
  const optionsWithFiles = readFiles(options)

  return initializeDockerode(optionsWithFiles)
}

export default initializeDocker
