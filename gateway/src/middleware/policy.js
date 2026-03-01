const policies = require("../../policies.json");

const policyMiddleware = async (request, reply) => {

    const path = request.url; // already includes /api

    const policy = policies[path];

    if (!policy) {
        console.log("POLICY NOT FOUND FOR:", path);
        return reply.code(404).send({ error: "No policy defined for route" });
    }

    request.policy = policy;
    request.budget = policy.limit;

    console.log("POLICY FOUND:", path);
};

module.exports = policyMiddleware;