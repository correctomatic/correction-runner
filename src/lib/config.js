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
  const fileContent = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(fileContent)
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
