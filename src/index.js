import Fastify from 'fastify'
const fastify = Fastify({
    logger: true
})

fastify.get("/", async (request, reply) => {
    return { hello: 'world' }
})

fastify.post('/eternal/balance', async (request, reply) => {
    return request.body
})

const start = async () => {
    try {
        await fastify.listen({ port: 3000 })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()