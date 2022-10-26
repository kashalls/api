import { v4 as uuidv4 } from 'uuid'

export default async function (fastify) {

    const onRequest = [fastify.eternalAuthenticate]

    fastify.post('/regenerate-key', { onRequest }, async (request, reply) => {
        const users = fastify.mongo.db.collection('users')
        const { uuid } = request.body;
    
        if (request.user.sub !== uuid) throw new Error('USER_TOKEN_MISMATCH')
        const query = { _id: uuid }
        const existingUser = await users.findOne(query)
        if (!existingUser) throw new Error('USER_ERROR_NOT_FOUND')
    
        const jti = uuidv4()
        const token = await fastify.jwt.sign({ sub: uuid, jti });
        const update = {
            $set: {
                apiKey: {
                    token,
                    jti
                }
            }
        }
    
        const updatedUser = await users.findOneAndUpdate(query, update)
        if (!updatedUser.ok) {
            console.log(updatedUser)
            throw new Error('SERVER_FAILED_UPDATE')
        }
    
        return { uuid, token }
    })
}