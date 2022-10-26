import fastifyPlugin  from 'fastify-plugin'
import mongodb from '@fastify/mongodb'

const url = process.env.MONGODB

function plugin (fastify, options, next) {
    fastify.register(mongodb, { url })
    
    next()
}

export default fastifyPlugin(plugin, { name: 'mongodb' })