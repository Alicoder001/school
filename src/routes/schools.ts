import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { requireRoles, requireSchoolScope } from "../utils/authz";
import { sendHttpError } from "../utils/httpErrors";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const user = request.user;
      if (user.role !== "SUPER_ADMIN")
        return reply.status(403).send({ error: "forbidden" });
      return prisma.school.findMany();
    },
  );

  // Yangi maktab qo'shish - admin bilan birga
  fastify.post(
    "/",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const user = request.user;
      if (user.role !== "SUPER_ADMIN")
        return reply.status(403).send({ error: "forbidden" });
      
            const {
              name,
              address,
              phone,
              email,
              lateThresholdMinutes,
              absenceCutoffMinutes,
              // Admin ma'lumotlari
              adminName,
              adminEmail,
              adminPassword,
            } = request.body as any;
      
            // Email validatsiya
            if (adminEmail) {
              const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
              if (!emailRegex.test(adminEmail)) {
                return reply.status(400).send({ error: "Noto'g'ri email formati" });
              }
      
              // Email mavjudligini tekshirish
              const existingUser = await prisma.user.findUnique({
                where: { email: adminEmail },
              });
              if (existingUser) {
                return reply.status(400).send({ error: "Bu email allaqachon ro'yxatdan o'tgan" });
              }
            }
      
            // Parol validatsiya
            if (adminPassword && adminPassword.length < 6) {
              return reply.status(400).send({ error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" });
            }
      
            try {
              // Transaction bilan maktab va admin yaratish
              const result = await prisma.$transaction(async (tx) => {
                // Maktab yaratish
                          const school = await tx.school.create({
                            data: {
                              name,
                              address,
                              phone,
                              email,
                              lateThresholdMinutes: lateThresholdMinutes || 15,
                              absenceCutoffMinutes: absenceCutoffMinutes || 180,
                              webhookSecretIn: uuidv4(),
                              webhookSecretOut: uuidv4(),
                            },
                          });          // Admin yaratish (agar ma'lumotlar berilgan bo'lsa)
          let admin = null;
          if (adminName && adminEmail && adminPassword) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            admin = await tx.user.create({
              data: {
                name: adminName,
                email: adminEmail,
                password: hashedPassword,
                role: "SCHOOL_ADMIN",
                schoolId: school.id,
              },
            });
          }

          return { school, admin };
        });

        return {
          ...result.school,
          admin: result.admin ? {
            id: result.admin.id,
            name: result.admin.name,
            email: result.admin.email,
          } : null,
        };
      } catch (err: any) {
        console.error("School creation error:", err);
        if (err.code === "P2002") {
          return reply.status(400).send({ error: "Bu email allaqachon mavjud" });
        }
        return reply.status(500).send({ error: "Maktab yaratishda xatolik" });
      }
    },
  );

  fastify.get(
    "/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN', 'TEACHER', 'GUARD']);
        requireSchoolScope(user, id);

        const school = await prisma.school.findUnique({ where: { id } });
        if (!school) return reply.status(404).send({ error: "not found" });
        return school;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, id);

        const {
          name,
          address,
          phone,
          email,
          lateThresholdMinutes,
          absenceCutoffMinutes,
          timezone,
        } = request.body;
        const school = await prisma.school.update({
          where: { id },
          data: {
            name,
            address,
            phone,
            email,
            lateThresholdMinutes,
            absenceCutoffMinutes,
            timezone,
          },
        });
        return school;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/:id/webhook-info",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, id);

        const school = await prisma.school.findUnique({ where: { id } });
        if (!school) return reply.status(404).send({ error: "Not found" });
        const base = `${request.protocol}://${request.hostname}`;
        return {
          in: `${base}/webhook/${school.id}/in?secret=${school.webhookSecretIn}`,
          out: `${base}/webhook/${school.id}/out?secret=${school.webhookSecretOut}`,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}
