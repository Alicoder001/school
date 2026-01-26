import { FastifyInstance } from 'fastify';
import { attendanceEmitter, AttendanceEventPayload } from '../eventEmitter';

export default async function (fastify: FastifyInstance) {
  // SSE endpoint for real-time attendance events
  // Note: EventSource doesn't support custom headers, so we accept token via query param
  fastify.get(
    '/schools/:schoolId/events/stream',
    async (request: any, reply) => {
      const { schoolId } = request.params;
      const { token } = request.query;

      // Verify JWT token from query param
      if (!token) {
        return reply.status(401).send({ error: 'Missing token' });
      }

      try {
        await fastify.jwt.verify(token);
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      // Set SSE headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');

      // Send initial connection message
      reply.raw.write(`data: ${JSON.stringify({ type: 'connected', schoolId })}\n\n`);

      // Handler for attendance events
      const eventHandler = (payload: AttendanceEventPayload) => {
        if (payload.schoolId === schoolId) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'attendance', ...payload })}\n\n`);
        }
      };

      // Subscribe to events
      attendanceEmitter.on('attendance', eventHandler);

      // Heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        reply.raw.write(`: heartbeat\n\n`);
      }, 30000);

      // Cleanup on disconnect
      request.raw.on('close', () => {
        attendanceEmitter.off('attendance', eventHandler);
        clearInterval(heartbeat);
      });

      // Keep connection open (don't call reply.send())
      await new Promise(() => {});
    }
  );
}
