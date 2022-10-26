import { readFileSync } from 'fs'   

import fastifyPlugin  from 'fastify-plugin'
import FastifyJWT from '@fastify/jwt'

import { messages } from './messages.js'

function plugin (fastify, options, next) {
    fastify.register(FastifyJWT, {
        secret: {
            private: readFileSync(new URL('../../keys/private.key', import.meta.url), 'utf8'),
            public: readFileSync(new URL('../../keys/public.key', import.meta.url), 'utf8')
        },
        sign: {
            algorithm: 'EdDSA',
            iss: 'api.kashall.dev'
        },
        verify: {
            allowedIss: 'api.kashall.dev'
        },
        messages
    })

    fastify.decorate('eternalAuthenticate', async (request, reply) => {
        try {
            const users = await fastify.mongo.db.collection('users')
            const jwtData = await request.jwtVerify()
            const user = await users.findOne({ _id: jwtData.sub })
            if (!user || user.apiKey.jti !== jwtData.jti) {
                reply.code(401)
                throw new Error('Invalid authorization token provided.')
            }
        } catch (error) {
            reply.send(error)
        }
    })

    next()
}

const options = {
    name: 'jwt',
    dependencies: ['mongodb']
}

export default fastifyPlugin(plugin, options)