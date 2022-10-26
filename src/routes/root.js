export default async function (fastify) {

    fastify.get('/', async (request, reply) => {
        return { hello: 'world' }
    })

}