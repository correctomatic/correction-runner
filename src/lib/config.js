import fs from 'fs'

function mergeDeep(target, source) {
  const output = {...target}
  if (typeof target === 'object' && typeof source === 'object') {
    Object.keys(source).forEach(key => {
      if (source[key] instanceof Object && key in target) {
        output[key] = mergeDeep(target[key], source[key])
      } else {
        output[key] = source[key]
      }
    })
  }
  return output
}

function readJSONFile(filePath) {
  let fileContent
  try {
    fileContent = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    throw(`Failed to read configuration file ${filePath}`, e)
  }

  try {
    return JSON.parse(fileContent)
  } catch (e) {
    throw(`Failed to parse configuration file ${filePath}`, e)
  }
}

function parseJSONEnvVar(envVar) {
  if(!envVar) return undefined

  try {
    return JSON.parse(envVar)
  } catch (e) {
    throw(`Failed to parse JSON environment variable contents: ${envVar}`, e)
  }
}

export {
  mergeDeep,
  readJSONFile,
  parseJSONEnvVar
}
