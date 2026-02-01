import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import { requireRoles } from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import { logAudit } from "../../../utils/audit";
import {
  MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS,
  MEDIAMTX_DEPLOY_ENABLED,
} from "../../../config";
import { buildMediaMtxConfigForNode } from "../../cameras/services/mediamtx-config.service";
import { deployMediaMtxConfig } from "../../cameras/services/mediamtx-deploy.service";

function isSafeHost(value: string): boolean {
  return /^[a-zA-Z0-9.-]+$/.test(value);
}

function isSafeUser(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

function isSafeRemotePath(value: string): boolean {
  return value.startsWith("/") && !value.includes("..") && !value.includes("~");
}

function isSafeLocalPath(value: string): boolean {
  if (!value) return false;
  if (!value.includes("mediamtx")) return false;
  return true;
}

function isSafeRestartCommand(value: string): boolean {
  if (!value) return false;
  return (
    value.includes("mediamtx") ||
    value.includes("systemctl restart") ||
    value.includes("docker restart")
  );
}

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/mediamtx-nodes",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const user = request.user;
        requireRoles(user, ["SUPER_ADMIN"]);
        const nodes = await prisma.mediaNode.findMany({
          orderBy: { name: "asc" },
        });
        return nodes;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/mediamtx-nodes",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const user = request.user;
        requireRoles(user, ["SUPER_ADMIN"]);
        const {
          name,
          webrtcBaseUrl,
          hlsBaseUrl,
          rtspPullEgressIp,
          isActive = true,
          capacityWeight = 1,
        } = request.body as any;

        if (!name || !webrtcBaseUrl) {
          return reply.status(400).send({ error: "name and webrtcBaseUrl required" });
        }

        const node = await prisma.mediaNode.create({
          data: {
            name,
            webrtcBaseUrl,
            hlsBaseUrl: hlsBaseUrl || null,
            rtspPullEgressIp: rtspPullEgressIp || null,
            isActive: Boolean(isActive),
            capacityWeight: Number(capacityWeight) || 1,
          },
        });

        logAudit(fastify, {
          action: "mediamtx.node.create",
          level: "info",
          message: "MediaMTX node created",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          extra: { nodeId: node.id, name: node.name },
        });

        return node;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/mediamtx-nodes/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const user = request.user;
        requireRoles(user, ["SUPER_ADMIN"]);
        const { id } = request.params;
        const {
          name,
          webrtcBaseUrl,
          hlsBaseUrl,
          rtspPullEgressIp,
          isActive,
          capacityWeight,
        } = request.body as any;

        const existing = await prisma.mediaNode.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: "not found" });

        const node = await prisma.mediaNode.update({
          where: { id },
          data: {
            name,
            webrtcBaseUrl,
            hlsBaseUrl: hlsBaseUrl ?? undefined,
            rtspPullEgressIp: rtspPullEgressIp ?? undefined,
            isActive: typeof isActive === "boolean" ? isActive : undefined,
            capacityWeight:
              typeof capacityWeight === "number" ? capacityWeight : undefined,
          },
        });

        logAudit(fastify, {
          action: "mediamtx.node.update",
          level: "info",
          message: "MediaMTX node updated",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          extra: { nodeId: node.id, name: node.name },
        });

        return node;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/mediamtx-nodes/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const user = request.user;
        requireRoles(user, ["SUPER_ADMIN"]);
        const { id } = request.params;

        const inUse = await prisma.school.count({
          where: { mediaNodeId: id },
        });
        if (inUse > 0) {
          return reply
            .status(400)
            .send({ error: "node is assigned to schools" });
        }

        await prisma.mediaNode.delete({ where: { id } });
        logAudit(fastify, {
          action: "mediamtx.node.delete",
          level: "info",
          message: "MediaMTX node deleted",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          extra: { nodeId: id },
        });
        return { ok: true };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/mediamtx-nodes/:id/mediamtx-config",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const user = request.user;
        requireRoles(user, ["SUPER_ADMIN"]);
        const { id } = request.params;

        const node = await prisma.mediaNode.findUnique({ where: { id } });
        if (!node) return reply.status(404).send({ error: "not found" });

        const content = await buildMediaMtxConfigForNode(id);
        const filename = `mediamtx_node_${id}.yml`;
        reply
          .header("Content-Type", "text/yaml; charset=utf-8")
          .header("Content-Disposition", `attachment; filename=\"${filename}\"`)
          .send(content);
        return;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/mediamtx-nodes/:id/mediamtx-deploy",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        if (!MEDIAMTX_DEPLOY_ENABLED) {
          return reply.status(400).send({ error: "deploy disabled" });
        }

        const user = request.user;
        requireRoles(user, ["SUPER_ADMIN"]);
        const { id } = request.params;
        const { mode, ssh, docker } = request.body as any;

        const node = await prisma.mediaNode.findUnique({ where: { id } });
        if (!node) return reply.status(404).send({ error: "not found" });

        const content = await buildMediaMtxConfigForNode(id);

        if (mode !== "ssh" && mode !== "docker" && mode !== "local") {
          return reply.status(400).send({ error: "invalid deploy mode" });
        }

        if (mode === "ssh") {
          if (!ssh?.host || !ssh?.user || !ssh?.remotePath) {
            return reply.status(400).send({ error: "ssh config required" });
          }
          if (!isSafeHost(ssh.host) || !isSafeUser(ssh.user)) {
            return reply.status(400).send({ error: "invalid ssh host/user" });
          }
          if (!isSafeRemotePath(ssh.remotePath)) {
            return reply.status(400).send({ error: "invalid remote path" });
          }
          if (
            ssh.restartCommand &&
            (!MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS ||
              !isSafeRestartCommand(ssh.restartCommand))
          ) {
            return reply.status(400).send({ error: "invalid restartCommand" });
          }
        }

        if (mode === "docker") {
          if (!docker?.container || !docker?.configPath) {
            return reply.status(400).send({ error: "docker config required" });
          }
        }

        if (mode === "local") {
          if (!request.body?.local?.path) {
            return reply.status(400).send({ error: "local path required" });
          }
          if (!isSafeLocalPath(request.body.local.path)) {
            return reply.status(400).send({ error: "invalid local path" });
          }
          if (
            request.body?.local?.restartCommand &&
            !MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS
          ) {
            return reply
              .status(400)
              .send({ error: "local restartCommand disabled" });
          }
          if (
            request.body?.local?.restartCommand &&
            !isSafeRestartCommand(request.body.local.restartCommand)
          ) {
            return reply
              .status(400)
              .send({ error: "invalid local restartCommand" });
          }
        }

        const result = await deployMediaMtxConfig({
          content,
          mode,
          ssh,
          docker,
          local: request.body?.local,
        });

        logAudit(fastify, {
          action: "mediamtx.node.deploy",
          level: "info",
          message: "MediaMTX node deploy triggered",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          extra: { nodeId: id },
        });

        return { status: "ok", result };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}
