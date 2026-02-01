import { FastifyInstance } from "fastify";
import crypto from "crypto";
import prisma from "../../../prisma";
import { requireRoles, requireSchoolScope } from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import { logAudit } from "../../../utils/audit";
import { AGENT_PAIRING_TTL_MINUTES, AGENT_TOKEN_TTL_SECONDS } from "../../../config";

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex");
}

export default async function (fastify: FastifyInstance) {
  fastify.post(
    "/schools/:schoolId/agent-pairing",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const ttlMinutesRaw = Number(request.body?.ttlMinutes);
        const ttlMinutes =
          Number.isFinite(ttlMinutesRaw) && ttlMinutesRaw > 0
            ? Math.min(ttlMinutesRaw, 60)
            : AGENT_PAIRING_TTL_MINUTES;

        const code = generateCode();
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

        const pairing = await prisma.agentPairing.create({
          data: {
            schoolId,
            code,
            expiresAt,
            createdByUserId: user.sub,
          },
        });

        logAudit(fastify, {
          action: "agent.pairing.create",
          level: "info",
          message: "Agent pairing code created",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          schoolId,
          extra: { pairingId: pairing.id, expiresAt: pairing.expiresAt },
        });

        return { code, expiresAt };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post("/agent/pair", async (request: any, reply) => {
    try {
      const { code } = request.body as any;
      if (!code) return reply.status(400).send({ error: "code required" });

      const pairing = await prisma.agentPairing.findUnique({
        where: { code },
      });
      if (!pairing) return reply.status(404).send({ error: "invalid code" });
      if (pairing.usedAt) {
        return reply.status(400).send({ error: "code already used" });
      }
      if (pairing.expiresAt.getTime() < Date.now()) {
        return reply.status(400).send({ error: "code expired" });
      }

      const update = await prisma.agentPairing.updateMany({
        where: { id: pairing.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (update.count === 0) {
        return reply.status(400).send({ error: "code already used" });
      }

      const token = fastify.jwt.sign(
        { sub: `agent:${pairing.id}`, role: "AGENT", schoolId: pairing.schoolId },
        { expiresIn: AGENT_TOKEN_TTL_SECONDS },
      );

      return { token, expiresIn: AGENT_TOKEN_TTL_SECONDS, schoolId: pairing.schoolId };
    } catch (err) {
      return sendHttpError(reply, err);
    }
  });
}
