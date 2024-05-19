import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'

const currentDirPath = dirname(fileURLToPath(import.meta.url))

const SCHEMA_FILE = 'container_response_schema.json'

const schemaFilePath = join(currentDirPath, SCHEMA_FILE)
const fileContents = fs.readFileSync(resolve(schemaFilePath), 'utf8')
const CONTAINER_RESPONSE_SCHEMA = JSON.parse(fileContents)

export {
  CONTAINER_RESPONSE_SCHEMA
}
