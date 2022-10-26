import { validate, version } from "uuid";

export default async function (fastify) {

    fastify.get('/' , async (request, reply) => {
        const search = request.query.search;
        if (!search) {
            reply.code(400)
            throw new Error('Search query missing.')
        }

        const uuids = fastify.mongo.db.collection('uuids')

        if (validate(search) && version(search) === 4) {
            const data = await uuids.findOne({ uuid: search })
            if (!data) {
                reply.code(404)
                throw new Error('No data was found.')
            }
            delete data._id
            return { ...data }
        } 

        // Its probably a str
         const possible = await uuids.find({ "username": { $regex: search } })
         if (!possible || possible.length === 0) {
            return []
         }

         possible.forEach((pos) => delete pos._id)
         return possible
    })
}