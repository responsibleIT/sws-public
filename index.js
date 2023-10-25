const fastify = require('fastify')({logger: true});
const path = require('path');
const sdk = require("node-appwrite");
const {Eta} = require("eta");
require('dotenv').config();

fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public'), prefix: '/public',
})

fastify.register(require('@fastify/view'), {
    engine: {
        eta: new Eta(),
    },
});

fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).view('/views/error.eta', {title: 'Error | Six Word Story', authenticated: false});
});

const start = async () => {
    let client = new sdk.Client();
    client
        .setEndpoint(process.env.AW_ENDPOINT)
        .setProject(process.env.AW_PROJECT_ID)
        .setKey(process.env.AW_API_KEY);

    const database = new sdk.Databases(client);
    const stories = (await database.listDocuments(process.env.AW_DATABASE_ID, process.env.AW_SWS_COLLECTION_ID)).documents;

    fastify.get('/', async (request, reply) => {
        return reply.view('/views/index.eta', {story: stories[0].story});
    });

    fastify.get('/:id', async (request, reply) => {
        let id = request.params.id;
        let exists = stories.filter((story) => story.$id === id);
        if(exists.length === 0){
            return reply.view('/views/error.eta', {title: 'Error | Six Word Story', authenticated: false});
        } else {
            return reply.view('/views/index.eta', {story: exists[0].story});
        }
    });

    try {
        await fastify.listen({host: "0.0.0.0", port: process.env.PORT || 3000})
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}

start()