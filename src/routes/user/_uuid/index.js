export default async function (fastify) {

    fastify.get('/', async (request, reply) => {
        const uuid = request.params.uuid;
        if (!uuid) {
            reply.code(400)
            throw new Error('Please specify a uuid to lookup.')
        }
    
        const users = fastify.mongo.db.collection('users')
        const userExists = await users.findOne({ _id: uuid })
        if (!userExists) throw new Error('User does not exist.');
        if (!userExists.meta.public) {
            if (!request.headers.authorization || request.headers.authorization.length === 0) {
                reply.code(200)
                return {
                    message: 'User is private.'
                }
            }
            const isAuth = await fastify.eternalAuthenticate(request, reply)
            if (!isAuth) return;
            if (request.user.sub !== userExists._id) {
                reply.code(403)
                throw new Error('User does not have access to this resource.')
            }
        }
    
        const balances = fastify.mongo.db.collection('balances')
        const bal = await balances.findOne({ uuid }, { sort: { date: -1 }, limit: 1 })
        delete bal._id
    
        return bal;
    })

}