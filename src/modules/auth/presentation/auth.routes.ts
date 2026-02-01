import { FastifyInstance } from 'fastify';
import prisma from "../../../prisma";
import bcrypt from 'bcryptjs';
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_TTL_SECONDS,
  AUTH_RETURN_TOKEN_IN_PROD,
  IS_PROD,
  SSE_TOKEN_TTL_SECONDS,
} from "../../../config";

const buildAuthCookie = (token: string) =>
  `${AUTH_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${AUTH_COOKIE_TTL_SECONDS}`;

const getCookieValue = (cookieHeader: string | undefined, name: string) => {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return undefined;
};

export default async function (fastify: FastifyInstance) {
  fastify.post('/login', async (request: any, reply) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return reply.status(401).send({ error: 'Invalid credentials' });

    const token = fastify.jwt.sign({ sub: user.id, role: user.role, schoolId: user.schoolId });
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    if (IS_PROD) {
      reply.header("Set-Cookie", buildAuthCookie(token));
      if (!AUTH_RETURN_TOKEN_IN_PROD) {
        return { user: safeUser };
      }
    }
    return { token, user: safeUser };
  });

  fastify.get('/me', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const userId = (request.user as any).sub;
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
    if (!user) return null;
    if (!user.school) return user;
    const { webhookSecretIn, webhookSecretOut, ...safeSchool } = user.school as any;
    return { ...user, school: safeSchool };
  });

  fastify.post('/refresh', async (request: any, reply) => {
    // simplistic refresh: verify and reissue
    try {
      const cookieToken = getCookieValue(request.headers.cookie, AUTH_COOKIE_NAME);
      if (cookieToken) {
        await request.jwtVerify({ token: cookieToken });
      } else {
        await request.jwtVerify();
      }
      const userId = request.user.sub;
      const u = await prisma.user.findUnique({ where: { id: userId } });
      if (!u) return { error: 'User not found' };
      const token = fastify.jwt.sign({ sub: u.id, role: u.role, schoolId: u.schoolId });
      if (IS_PROD) {
        reply.header("Set-Cookie", buildAuthCookie(token));
        if (!AUTH_RETURN_TOKEN_IN_PROD) {
          return { ok: true };
        }
      }
      return { token };
    } catch (err) {
      return { error: 'Invalid token' };
    }
  });

  fastify.post('/logout', async (_request: any, reply) => {
    if (IS_PROD) {
      reply.header(
        "Set-Cookie",
        `${AUTH_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
      );
    }
    return { ok: true };
  });

  // Short-lived token for SSE usage (prod-friendly)
  fastify.get('/sse-token', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const user = request.user as any;
    const expiresIn = IS_PROD ? SSE_TOKEN_TTL_SECONDS : 3600;
    const token = fastify.jwt.sign(
      { sub: user.sub, role: user.role, schoolId: user.schoolId, sse: true },
      { expiresIn }
    );
    return { token, expiresIn };
  });
}
