const fastify = require("fastify")();

fastify.get("/test", async () => {
    return { message: "Backend response OK" };
});

fastify.listen({ port: 4000 }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log("Backend running on port 4000");
});