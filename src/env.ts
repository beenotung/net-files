import { populateEnv } from 'populate-env'

export let env = {
  PORT: 8100,
}

populateEnv(env, { auto_load: true, mode: 'halt' })
